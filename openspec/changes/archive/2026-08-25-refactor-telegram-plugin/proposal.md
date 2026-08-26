## Why

`dsh-telegram` 插件目前把 SDK 事件路由、命令解析、Session 生命周期、dsh 集成、reaction、流式渲染、媒体交付、错误分类全部堆在一个 603 行的 `TelegramRuntime` 类里，并包含多处"补丁"：内联复刻 dsh 运行时能力、手写 JSON 文件持久化（附带一堆"绝不落 cwd"的告诫）、以及一个只求"尽力而为"的手写 MarkdownV2 状态机。经核实，其中两处补丁已有官方替代路径（`ctx.agentPresets` 已发布、`@deepseek-ai/dsh-storage-domain` 已发布上 npm），可以去掉；正文富文本可统一到 HTML，与既有工具卡/状态卡一致，容错更好。现在重构可在功能完全兼容的前提下，显著降低对 dsh 内部实现的耦合与后续维护成本。

## What Changes

- **模块重划**：拆解上帝类 `TelegramRuntime`，`runtime.js` 仅保留编排职责；按 `agent/`（dsh 集成）、`commands.js`、`render/`（stream + renderer + html + cards）、`transport/`（client + transport + inbound）、`persist.js` 分层。行为不变。
- **会话持久化切换到官方 storage 子系统**：用 `ctx.storageDomain` + `defineDomain` 替代手写 `SessionStore`。删除 `session-store.js`、`defaultStatePath()`、`$DSH_HOME` 路径推导与"绝不落 cwd"补丁。绑定语义（按私聊用户 ID → Session ID、Workspace 归属校验）保持不变。
- **正文渲染统一到 HTML parse_mode**：删除手写 MarkdownV2 状态机 `markdown.js`，改为 Markdown→受限 HTML（Telegram 支持的标签子集）。正文与既有工具卡/状态卡/控制卡的 parse_mode 一致；保留发送失败降级为纯文本的兜底。
- **去除 model-selection 内联复刻（待测试验证）**：`installModelSelection` 的双 waterfall 复刻改为在 create 与 resume 两侧都传 `agentOptions`（provider/model 快照）。用契约测试锁定"传给 `agents.create/resume` 的 `agentOptions` 恒等于 `currentSelection()` 快照"。若测试与真机验证通过则删除复刻，否则集中标注并加测试锁行为回退。
- **正规化 dsh 集成入口**：`preset.mount` 改为通过 `inject` 声明并使用 `ctx.agentPresets.mount(agentCtx, id?)`，去掉 `ctx.get()` 兜底。
- **清理死代码**：删除 `#runCommand` 中不可达的 `stop` 分支（`/stop` 已在 `#handleMessage` 走 `#stopImmediately`）、未被调用的 `SessionStore.clearWorkspace`/`SessionStore.remove`、`message.js#textFromContent`。
- **新增依赖**：`@deepseek-ai/dsh-storage-domain`（自带 `zod`）。

## Capabilities

### New Capabilities

无。本次为内部重构，不引入新能力。

### Modified Capabilities

- `telegram-private-chat`：以下 requirement 的措辞随实现细化而更新，外部可观察行为保持兼容——
  - **私聊会话路由**：绑定持久化底座由插件私有文件改为 dsh storage 子系统（对用户行为无感）。
  - **出站消息交付** 与 **出站类型映射**：正文文本交付明确为"Markdown→受限 HTML 富文本渲染，渲染失败降级为纯文本"，取代原先的 MarkdownV2 尽力而为路径。

## Impact

- **代码**：`packages/plugins/dsh-telegram/src/**` 全量重组；`test/**` 相应调整并新增契约测试。`src/client.js`（浏览器设置 UI）不受影响。
- **依赖**：新增 `@deepseek-ai/dsh-storage-domain`；`node:os`（`homedir`）随 `defaultStatePath` 删除而移除。
- **运行时集成**：`inject` 增加 `storageDomain`、`agentPresets`；移除对手写状态文件路径的依赖。
- **数据迁移**：旧的 `$DSH_HOME/telegram-sessions.json` 绑定不自动迁移（见回滚计划）；首版为 pre-release，可接受用户重新 `/new` 建立会话。

## Rollback Plan

- 重构以分批提交落地，每批独立可回退（`git revert`）。
- 持久化切换是唯一涉及数据形态的改动：新旧存储位置不同，切换后旧文件被忽略。回滚只需 revert 持久化批次的提交即可恢复文件方式；无破坏性数据删除操作。
- `installModelSelection` 的删除单独成批：若真机验证出现 DSML 泄漏，仅 revert 该批次即可恢复内联复刻，不影响其余重构。
