# Proposal

## Why

`@implementsio/dsh-telegram` 当前只声明并验证兼容 dsh `0.2.0-rc.2`，不能与用户指定的 `@deepseek-ai/dsh@0.2.1-rc.5` 作为同一套依赖图安全运行。需要将插件迁移到该精确版本，并用运行时、客户端和包契约测试确认上游接口变化没有破坏 Telegram 私聊能力。

## What Changes

- **BREAKING**：插件兼容目标从 dsh `0.2.0-rc.2` 切换为 `0.2.1-rc.5`，不承诺一个插件版本同时兼容两个 dsh 预发布版本。
- 将插件直接使用和客户端注入的 `@deepseek-ai/dsh-*` 包精确锁定到 `0.2.1-rc.5`，更新 lockfile，并保持单一 Cordis/dsh 服务依赖图。
- 按 `0.2.1-rc.5` 的公开导出与服务契约调整 Agent 创建/恢复、模型选择、Session 事件、审批与用户问题路由、storage domain、Loader Settings、credentials RPC 和 Plugin Manager row 配置接入。
- 保留现有 Telegram Owner 私聊、Workspace/Session 绑定、模型切换、媒体、流式输出、交互路由和 runtime 串行重建行为；已有 `telegram_bindings` 数据继续兼容读取。
- 更新包版本映射、README、本地 link 验收计划和自动化兼容测试。此次不发布 npm 包。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `telegram-private-chat`：将宿主兼容契约及对应启动、设置、凭据、Session 恢复和交互行为的目标版本更新到 dsh `0.2.1-rc.5`。

## Impact

- 受影响包：`packages/plugins/dsh-telegram`。
- 受影响路径：`packages/plugins/dsh-telegram/package.json`、`src/**`、`test/**`、`README.md`、生成的 `lib/client.js`、`pnpm-lock.yaml`；若真实 API 差异要求调整 bundle patch，则同时修改 `cordis.patch.yml` 及其生成脚本。
- 外部依赖：`@deepseek-ai/dsh-agent`、`@deepseek-ai/dsh-storage-domain` 和四个客户端注入包升级为 `0.2.1-rc.5`；传递 dsh 包随 lockfile 对齐。
- 外部系统：本地 dsh web profile 仅用于 link 验收；不修改永久 profile 配置，不发布 registry 包。
- 数据：`telegram_bindings` domain 版本保持 `1`，不计划迁移或删除已有绑定。

## Delivery Impact

- 长期文档：需要，更新 `docs/5-release.md` 中 dsh-telegram 当前兼容版本与版本映射约束；若 CI 事实不变，不修改 `docs/4-ci-cd.md`。
- 入口文档：需要，更新 `packages/plugins/dsh-telegram/README.md` 的兼容版本、版本映射、验收和回滚说明。
- 版本：需要，`packages/plugins/dsh-telegram` / **MAJOR** / 更新 `packages/plugins/dsh-telegram/package.json` 的 `version` 为以 `2.0.0` 为 plugin core、以 `dsh.0.2.1-rc.5` 为兼容后缀的版本 / 依据是精确支持的 dsh 预发布宿主从 `0.2.0-rc.2` 切换到不向后兼容的新目标；同时更新 `engines.dsh` 和所有直接 dsh 依赖。
- 发布：不需要，本次只完成代码、构建产物与本地 link 验收准备；不执行 npm publish、tag 或部署。
- 验收：需要，运行 `pnpm -F dsh-telegram test`、`pnpm -F dsh-telegram build`、根级 `pnpm check`、`pnpm test`、`pnpm -r build`，并以 dsh `0.2.1-rc.5` web profile 执行不发布的本地 link 配置树与启动 smoke；CI 映射为 `nodejs-ci.yml` 的 `build` job，npm 发布 workflow 仍为空缺。
