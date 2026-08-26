# 技术设计

## 背景与约束

- 仅重构 `packages/plugins/dsh-telegram`；`src/client.js`（浏览器设置 UI，经 esbuild 打包为 `lib/client.js`）不在范围内。
- runtime 侧代码（`index.js` / `runtime.js` 等）**不经 esbuild**，由 dsh 进程直接 `import`，因此可通过 npm `dependencies` 解析 `@deepseek-ai/*` 包（现状：`@deepseek-ai/schemastery` 已如此使用）。
- 功能必须完全兼容：命令集（`/new` `/status` `/stop` `/help`）、Owner 访问控制、会话路由与 Workspace 归属校验、interaction 路由、reaction 反馈、媒体交付、错误分类，行为一律不变。
- 测试用 `node --test test/*.test.js`；lint 用 oxlint。内置模块用 `node:` 前缀；未使用 catch 参数用 `_` 前缀。

## 目标模块结构

```
src/
  index.js            接入层：apply / inject / settings.watch（基本不变）
  config.js           Schema + normalizeConfig + resolveCredentials（不变）

  agent/              —— dsh 集成，明确标注"贴运行时内部"
    integration.js      buildAgentSetup：组合 model-selection + interaction-bridge
                        + session-stream + preset.mount
    model-selection.js  installModelSelection（若验证可删则删；见下）
    lifecycle.js        sessionFor / createSession / resume / stopAgentTurn

  commands.js         parseCommand + 各命令 handler（删除死的 stop 分支）

  render/
    stream.js         StreamSession：流式协调（去抖、flush、工具卡编排）
    renderer.js       StreamRenderer（从 message.js 拆出）
    html.js           markdownToHtml（受限标签）+ escapeHtml
    cards.js          控制卡 / 状态卡 / 交互卡（原 outbound.js）

  transport/
    client.js         createTelegramClient（连接 / polling / 归一化事件）
    transport.js      createTelegramTransport（Bot API 方法封装）
    inbound.js        normalizeInboundMessage + splitMessageText（从 message.js 拆出）

  persist.js          bindings 持久化：封装 ctx.storageDomain（替代 session-store.js）

  runtime.js          仅编排：handleMessage 路由 / processMessage / reaction
                      / 媒体交付 / userFacingError
```

删除文件：`markdown.js`、`session-store.js`、`message.js`（内容拆入 `render/renderer.js` 与 `transport/inbound.js`）。

## 决策 1：会话持久化切换到 storage 子系统

用 `@deepseek-ai/dsh-storage-domain` 的 `defineDomain`：

```js
// persist.js（示意）
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { z } from 'zod';

const BindingSchema = z.object({ sessionId: z.string(), workspaceId: z.string() });

export const bindingsDomain = defineDomain({
  name: 'telegram-bindings',
  version: 1,
  tables: { bindings: domainTable(BindingSchema) }, // key = 私聊用户/chat ID
});
```

- `inject` 增加 `storageDomain`。在 `start()` 里 `await ctx.storageDomain.open(bindingsDomain)`，得到 `domain`；`stop()` 里 `await domain.close()`（或交由插件 disposer）。
- 读同步：`domain.table('bindings').get(chatId)` / `entries()`；写异步：`put/delete/update`（backend 负责原子写、`0o600`、路径）。
- **API 语义对齐**：现有 `SessionStore` 是"内存 Map + 异步落盘"，storage domain 是"同步读内存快照 + 异步写链"，语义天然吻合，`runtime.js` 中对 `#bindings.get/set/delete` 的调用点改为 domain 调用即可。
- 删除 `defaultStatePath()`、`homedir` import、所有"绝不落 cwd"注释与 `$DSH_HOME` 推导。
- **迁移**：不自动迁移旧 `telegram-sessions.json`。首版 pre-release，用户重新 `/new` 即可。

## 决策 2：正文渲染统一到 HTML

- Telegram HTML 仅支持有限标签：`b i u s a code pre` 及少量嵌套；转义仅需 `& < >`（属性值另转 `"`）。
- `render/html.js` 提供 `markdownToHtml(md)`：转换 Markdown 常见结构（粗体、斜体、行内代码、围栏代码块含语言、链接、删除线；标题降级为粗体）为上述标签，其余文本走 `escapeHtml`。
- **依赖取舍**：优先手写小型转换器（与现 `markdown.js` 规模相当但目标标签集更小、转义更简单），避免引入 markdown 库处理"流式半截标签"时反而更难控制闭合。若手写在代码块/嵌套上出现明显缺陷，再评估引库。
- `StreamSession.#sendRich/#editRich`：先尝试 `parse_mode: 'HTML'` 渲染发送，捕获 400 → 降级纯文本（沿用现有兜底结构，只是转换目标从 MarkdownV2 换成 HTML）。工具卡/状态卡/控制卡已是 HTML，`escapeHtml` 收敛到 `render/html.js` 单一实现。

## 决策 3：model-selection 复刻的去留（测试驱动）

现状：`installModelSelection` 用 `system-prompt/assemble` + `agent/request` 两个 waterfall 复刻官方快照语义，目的是防止 provider/model 漂移导致 DeepSeek 适配器把工具调用裸写成 DSML 文本。`CreateAgentOptions` / `ResumeAgentOptions` 都接受 `agentOptions`（per-agent provider/model）。当前 create 侧已传 `agentOptions`，**resume 侧未传**——复刻很可能是在补 resume 侧丢失的 selection。

验证策略（分两层）：
1. **契约测试（自动，必须过）**：mock `ctx.agents`，断言 `create` 与 `resume` 收到的 `agentOptions` 恒等于 `ctx.agentDefaultModel.currentSelection()` 的快照。以此锁定"两侧 selection 一致"这一行为，无论复刻是否保留。
2. **真机验证（手动）**：删除 `installModelSelection`、仅靠 resume 侧补传 `agentOptions` 后，重启 dsh 实测是否出现 DSML 泄漏。
   - 通过 → 删除复刻，`model-selection.js` 连同其测试移除，仅保留契约测试。
   - 不通过 → 保留 `model-selection.js`，集中标注"贴 dsh 内部、不可删"，并补单测锁两个 waterfall 的快照行为。

该批次独立提交，便于按验证结果单独回退。

## 决策 4：dsh 集成入口正规化 + 死代码清理

- `preset.mount`：`inject` 增加 `agentPresets`，改用 `ctx.agentPresets.mount(agentCtx, id?)`，移除 `ctx.get('agentPresets') ?? ctx.agentPresets` 兜底。
- `stopAgentTurn`：保留（`Agent.cancel` + `status` 是公开契约，非补丁）。
- 删除死代码：`#runCommand` 的 `stop` 分支、`SessionStore.clearWorkspace`、`SessionStore.remove`、`message.js#textFromContent`（均已确认无调用点）。

## 测试策略

- 保留并适配现有测试：`stream.test.js`、`runtime.test.js`、`core.test.js`、`markdown.test.js`（后者随 `markdown.js` 删除改为 `html.test.js`）。
- 新增：`persist.test.js`（mock storageDomain，断言绑定的增删查与重启恢复）；model-selection 契约测试并入 `runtime.test.js` 或独立文件。
- 每批重构后运行 `node --test` 全绿 + `pnpm lint`，再进入下一批。

## 风险

- **storage 包为 rc 版本**（`0.0.1-rc.1`）：API 可能变动。缓解——`persist.js` 单点封装，变动只影响一个文件。
- **HTML 流式半截标签**：与 MarkdownV2 同类问题，靠纯文本降级兜底，不追求边界完美。
- **删除复刻的回归**：DSML 泄漏是集成层现象，单测无法直接断言，依赖真机验证 + 独立批次可回退。
