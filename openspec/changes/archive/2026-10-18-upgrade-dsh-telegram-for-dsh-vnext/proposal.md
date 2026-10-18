# Proposal

## Why

`dsh-telegram` 当前面向 dsh `0.1.5-rc.1`，而 dsh `0.2.0-rc.2` 已重构 Loader Settings、浏览器插件配置入口和 Agent preset 持久化协议，现有插件将无法正确加载设置页、响应配置更新，并可能在 Session 恢复时挂载错误的 preset。需要将插件整体适配到目标版 dsh，同时保留现有 Telegram 私聊行为和已有绑定数据。

## What Changes

- **BREAKING**：最低兼容目标切换为 dsh `0.2.0-rc.2`，所有直接消费的 `@deepseek-ai/dsh-*` 依赖精确对齐该版本，不再承诺兼容 dsh `0.1.5-rc.1`。
- **BREAKING**：Host 配置从已移除的 `ctx.settings.register/get/watch` 迁移到 Loader entry `Config` 与 volatile update 生命周期；配置或 Bot Token 更新时串行重建 Telegram runtime，保证同一时间最多一个 polling 客户端。
- **BREAKING**：Web 设置页从已移除的 `settingsScope` / `settings.plugin.item` 迁移到 dsh `0.2.0-rc.2` 的 `ConfigForm` 与 Plugin Manager row 配置入口，并原子提交非敏感设置。
- 创建 Session 时解析并持有准确的 Agent preset revision，将同一 preset ID 同时写入 Session metadata 和挂载到 Agent scope；恢复 Session 时优先使用持久化 projection 中的 preset，防止重启后工具与系统提示漂移。
- 模型选择完整保留 dsh `0.2.0-rc.2` 支持的可选 `reasoningEffort`；已有不含该字段的 Telegram binding 继续直接读取，storage domain version 保持不变。
- 更新构建产物、README、契约测试和目标版 dsh smoke test，覆盖配置热更新、凭据更新、preset 恢复和插件单次注册。
- 最终 Web 验收统一通过 `dsh web` 启动 web profile。由于目标版 CLI 不支持明确 LAN IP 且拒绝 `--host 0.0.0.0`，经用户明确批准后使用不落库的临时 Loader overlay 将 webserver 绑定到 `0.0.0.0`，并为探测到的 LAN 地址配置 trusted host；该高风险例外仅限短时验收，不配置公网转发，结束后必须停止进程并删除 overlay。
- 验收阶段不发布插件，也不从 registry 安装待发布版本；先构建本地工作区包，再通过 dsh 的 profile 包管理入口以 `pnpm link` 将其链接到 web profile，验收后撤销本次链接。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `telegram-private-chat`：更新插件配置与生命周期、凭据设置页面、Session preset 恢复和模型选择继承在 dsh `0.2.0-rc.2` 下的行为契约。

## Impact

- 代码：`packages/plugins/dsh-telegram/src/index.js`、`config.js`、`client.js`、`client-credentials.js`、`runtime.js`、`agent/integration.js`、`persist.js`。
- 构建与发布：`packages/plugins/dsh-telegram/package.json`、`lib/client.js`、`pnpm-lock.yaml`、README 和插件版本。
- 测试：现有 Node 测试夹具需改为目标版 Loader/ConfigForm/preset 契约，并增加真实 dsh `0.2.0-rc.2` 配置树与加载 smoke test。
- 数据：继续读取现有 `telegram_bindings` version 1 数据，不自动迁移或重写既有绑定。
- 外部行为：Telegram 命令、Owner 限制、Workspace 路由、流式消息、审批/提问与媒体交付保持兼容；设置入口移动到 Plugin Manager 中该包的 `dsh-telegram` row 配置页。
- 验收环境：使用 `dsh web` 选择 `$DSH_HOME/profiles/web`（默认 `~/.dsh/profiles/web`），通过启动参数临时启用受控 LAN 访问；不将机器 IP 或 Bot Token写入仓库。
- 安装来源：验收中的 `@implementsio/dsh-telegram` 必须解析到当前仓库 `packages/plugins/dsh-telegram` 的绝对路径；link 会临时改变 web profile 的依赖状态，操作前后需记录并只清理本次链接。

## Rollback Plan

- 回退插件包、生成的客户端 bundle 和 lockfile 到上一发布版本，并在 dsh `0.1.5-rc.1` profile 中运行；不得让旧插件与 dsh `0.2.0-rc.2` 混用。
- 回退不删除或改写 credentials 与 `telegram_bindings`。新增的可选 `reasoningEffort` 会被旧 schema 忽略，旧记录也仍保持 version 1。
- 若只需紧急恢复 Bot，可先禁用目标版 profile 中的 Telegram row，停止 polling，再切回成套的旧 dsh 与旧插件，避免两个 runtime 同时消费更新。
