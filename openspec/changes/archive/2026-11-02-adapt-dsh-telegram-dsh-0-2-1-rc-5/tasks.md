# Tasks

## 1. 精确版本与依赖图

- [x] 1.1 先扩展 `test/package-contract.test.js`，断言目标为 `0.2.1-rc.5`、插件版本后缀与 `engines.dsh` 一致、所有直接 dsh 运行时及客户端注入包版本一致；在升级前运行 `pnpm -F dsh-telegram test -- package-contract.test.js`，记录旧清单无法满足新目标的失败证据
- [x] 1.2 将 `package.json` 的直接 `@deepseek-ai/dsh-*` 依赖、`engines.dsh` 与插件版本更新为 `2.0.0-dsh.0.2.1-rc.5`，执行 `pnpm install`；以 `pnpm -F dsh-telegram test -- package-contract.test.js` 和 `pnpm why @deepseek-ai/dsh-agent @deepseek-ai/dsh-storage-domain` 验证公开导出可加载且插件 importer 不再解析 `0.2.0-rc.2`
- [x] 1.3 检查 `package.json#dsh.client.inject` 中每个包的 `./client` export 和目标版 peer graph；运行 package-contract 测试证明四个注入包均解析为 `0.2.1-rc.5`，若目标版增删注入要求则同步清单和断言

## 2. Host 运行时适配

- [x] 2.1 在 `0.2.1-rc.5` 真实依赖上运行 `pnpm -F dsh-telegram test -- core.test.js host-lifecycle.test.js runtime.test.js model-command.test.js persist.test.js`，按失败契约最小调整 `src/index.js`、`src/runtime-coordinator.js`、`src/runtime.js`、`src/agent/integration.js` 和 `src/persist.js`；同一命令须验证 Loader/凭据重建、Agent create/resume、preset、Session 事件、审批/提问、模型选择和 storage 全部通过
- [x] 2.2 保持 `telegram_bindings` single layout version 1，并在 `persist.test.js` 与 `runtime.test.js` 中覆盖旧记录读取、历史 preset 恢复、缺失 preset 回退和 resume 失败重建；运行 `pnpm -F dsh-telegram test -- persist.test.js runtime.test.js` 验证无需数据迁移且模型选择不丢失
- [x] 2.3 清理源码中失效的旧版本注释但不重写无关逻辑；运行 `pnpm check`，并用 `git diff -- packages/plugins/dsh-telegram/src` 核对改动只涉及 `0.2.1-rc.5` 已证实变化的边界

## 3. Web 客户端与生成 bundle

- [x] 3.1 在目标依赖上运行 `pnpm -F dsh-telegram test -- client-credentials.test.js client-registration.test.js package-contract.test.js`，按失败契约最小调整 credentials RPC、ConfigForm、Workspace remote、Plugin Manager row slot 与 ModuleLoader 接入；同一命令须覆盖脱敏状态、revision mutation、row key 和 client inject
- [x] 3.2 执行 `pnpm -F dsh-telegram build` 重新生成 `lib/client.js`，再运行 `pnpm -F dsh-telegram test -- package-contract.test.js client-registration.test.js`，验证 bundle 可由 `0.2.1-rc.5` ModuleLoader wrapper 加载且不含已移除的服务名或 slot
- [x] 3.3 若目标版改变 package patch 或 row schema，更新 `scripts/write-patch.mjs`、`cordis.patch.yml` 和对应契约测试；运行 `pnpm -F dsh-telegram run patch` 后确认 `git diff --exit-code -- packages/plugins/dsh-telegram/cordis.patch.yml`，证明生成文件可复现

## 4. 包文档与长期契约

- [x] 4.1 更新 `packages/plugins/dsh-telegram/README.md` 的当前版本、映射示例、兼容边界、本地 link 验收和成套回滚说明；运行 `pnpm -F dsh-telegram acceptance:plan` 并核对文档命令只包含 test/build/link/dump-config/unlink 及经单独授权的具体 LAN IP 监听，不包含 wildcard、publish 或 registry 安装候选包
- [x] 4.2 更新 `docs/5-release.md`，记录 dsh-telegram 精确宿主版本随发布版本后缀同步的事实；核对 `docs/4-ci-cd.md` 的 `nodejs-ci`、手动 npm 通道和发布 gate 缺口未变化，因此不修改 CI 文档
- [x] 4.3 运行 `openspec validate adapt-dsh-telegram-dsh-0-2-1-rc-5 --strict`，验证 `telegram-private-chat` 增量规范、版本结论和文档描述一致

## 5. 集成、CI、版本与验收

- [x] 5.1 运行包级专项门 `pnpm -F dsh-telegram test` 与 `pnpm -F dsh-telegram build`；记录测试不发真实 Telegram 请求，且生成的 `lib/client.js` 为当前源码产物
- [x] 5.2 运行根级 `pnpm check`、`pnpm test` 和与 CI 相同的 `SESSION_SECRET=<CI占位值> pnpm -r --filter '!vela' build`，对应 `docs/4-ci-cd.md` 的 `nodejs-ci.yml` → `build` job；确认本次 `packages/**` 与 `pnpm-lock.yaml` 变更会被该无路径过滤 workflow 覆盖，且无需新增 CI gate
- [x] 5.3 对唯一受影响包给出最终版本结论：`packages/plugins/dsh-telegram` / **MAJOR** / 版本来源 `packages/plugins/dsh-telegram/package.json` / dsh 精确兼容目标从 `0.2.0-rc.2` 切换到不兼容的 `0.2.1-rc.5`；验证值为 `2.0.0-dsh.0.2.1-rc.5`，并确认本次不 tag、不部署、不执行 npm publish
- [x] 5.4 在停止的 dsh `0.2.1-rc.5` web profile 上记录依赖状态，通过 `dsh plugin --profile web link <dsh-telegram绝对路径>` 链接当前构建，运行 `dsh --profile web --dump-config` 验证 `id: dsh-telegram` 恰好一次、配置 schema 与 client inject 可解析；经用户授权后使用既有真实 Token、Owner 和代理启动 polling，临时切换到当前有效 Workspace，并由 Owner 发送 `/status` 验证真实状态卡回复；全程不得额外传同一 patch、开放 LAN 或执行 publish
- [x] 5.5 验收后通过 Plugin Manager 恢复原 Workspace ID，以 SIGINT 停止 web 与 polling，执行 `dsh plugin --profile web unlink @implementsio/dsh-telegram` 并与 link 前状态比较，验证 registry 版 `1.0.0-dsh.0.2.0-rc.2` 依赖和配置已恢复；不授予旧插件的版本风险豁免，记录 npm 发布 workflow 仍为“缺口：仅 `prepublishOnly` 与手动发布”

## Workflow follow-up

- 实现、评审和所需人工验收完成后，同步增量规范并归档该 change。
- 如需发布，另行取得明确授权后执行 npm 发布流程；本 change 的 apply 不执行发布。
- 如需具体 LAN IP 监听或真实 Bot/Token 真机验收，先取得针对网络暴露和凭据步骤的明确授权；不得使用 wildcard 地址。
