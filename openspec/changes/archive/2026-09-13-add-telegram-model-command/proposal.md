## Why

dsh-telegram 目前只能使用 dsh 全局默认模型：`runtime.js` 在 `#createSession` 与 resume 两处都从 `ctx.agentDefaultModel.currentSelection()` 取快照喂给 `agentOptions`，Owner 无法在 Telegram 内切换模型。要换模型只能去 Web UI 改全局默认，且改完对已存活的 Telegram Session 无效——`agentOptions` 是创建时的快照。

## What Changes

- 新增 `/model` 命令，两种形态：
  - `/model`（无参数）：以纯文本列出所有可路由 provider 及其模型，每行格式为可直接复制的 `<provider> <model>`，并标注当前生效选择
  - `/model <provider> <model>`：切换模型
- 切换后**当前 Session 立即生效**：通过 dsh 官方 `installModelSelection` 安装 Agent 级可变选择，下一个 step 进入 prompt assembly 时应用，历史对话保留、不新建 Session
- 切换结果**持久化到该私聊绑定**：`/new`、切换 Workspace、Session resume、插件重启后仍使用该选择；没有私聊级选择时回落到 `ctx.agentDefaultModel.currentSelection()`
- 模型校验走 `ctx.llm.resolveModelInfo(provider, model)` 而非列表白名单——dsh 明确规定模型目录是 advisory、不控制路由，未出现在列表中的模型仍可能可用
- **BREAKING（内部契约）**：`parseCommand` 不再对「命令携带参数」一律返回 `unsupported`，返回值结构从 `{ name }` 扩展为可携带参数
- 修复既有缺陷：`runtime.js` 三处绑定写入（470、484、501）均为整对象覆盖写，新增字段会在切换 Workspace 或 resume 失败重建时被静默抹掉

不做（留待后续变更）：`reasoningEffort` 选择、inline 按钮选择卡片、provider 省略推断。

## Capabilities

### New Capabilities

无。本变更扩展既有 Telegram 私聊能力，不引入新 capability。

### Modified Capabilities

- `telegram-private-chat`:
  - 「基础命令」要求从五个命令扩展为六个，新增 `/model` 及其注册与参数化行为；该要求当前隐含「所有控制命令结果使用结构化 card 交付」，需为模型列表放宽为纯文本（长列表无法在 4096 字符限制下安全分片 HTML `<blockquote>`）
  - 「私聊会话路由」要求新增私聊级模型选择的持久化与继承语义，以及绑定写入必须保留既有字段的约束

## Impact

代码：
- `packages/plugins/dsh-telegram/src/transport/client.js`：`TELEGRAM_COMMANDS` 注册表
- `packages/plugins/dsh-telegram/src/runtime.js`：`parseCommand`、`#runCommand`、`#createSession`、`#sessionFor`、`#switchWorkspace`，新增模型选择 ref 持有与 `#bridgeArgs`/`buildAgentSetup` 接入
- `packages/plugins/dsh-telegram/src/persist.js`：绑定 schema 增加两个 optional 字段，`set()` 改 merge 语义
- `packages/plugins/dsh-telegram/src/render/cards.js`：`controlCard` 标签表新增 `model`
- `packages/plugins/dsh-telegram/src/agent/integration.js`：`buildAgentSetup` / `installAgentBridges` 需接入模型选择安装
- `packages/plugins/dsh-telegram/README.md`：命令清单

版本：
- 插件 `0.3.1` → `0.4.0`（minor：新增面向用户的 `/model` 与一个新依赖，无破坏性变更）。`lib/client.js` 需重建，因为版本号在构建时内联并展示在 Settings UI

依赖：
- 新增 `@deepseek-ai/dsh-agent`（`installModelSelection` 的唯一来源）。该插件此前刻意只依赖 `dsh-storage-domain` + `schemastery`，本次是一次真实的耦合面扩大，且目标版本 `0.1.5-rc.1` 是 rc
- `inject` 新增 `llm`（模型目录与校验）

数据：
- `telegram_bindings` domain 的 `version` 保持 1。新增字段声明为 optional，两个方向都兼容，无需版本号介入；该 domain 是 `single` layout，bump version 会让既有部署启动失败（详见 design 决策 6）

## Rollback Plan

按依赖倒序回退，每一层独立可用：

1. **仅回退命令**：从 `TELEGRAM_COMMANDS` 移除 `/model`，`parseCommand` 正则去掉 `model` 分支。命令消失后已持久化的 provider/model 仍被 `#createSession` 读取并生效，无行为断裂
2. **回退热切换**：移除 `installModelSelection` 调用与 `@deepseek-ai/dsh-agent` 依赖，保留持久化路径。行为退化为「切换需 `/new` 后生效」，功能可用性降低但不出错
3. **完整回退**：`git revert` 变更提交。因 `version` 未变，旧代码打开该 domain 不会触发版本戳拒绝；多出的 `provider`/`model` 字段会被 zod object 默认剥离。两点均已有测试固定

数据无损：绑定记录的 `sessionId`/`workspaceId` 在任何回退路径下都不受影响，最坏情况是模型选择丢失、回落全局默认。
