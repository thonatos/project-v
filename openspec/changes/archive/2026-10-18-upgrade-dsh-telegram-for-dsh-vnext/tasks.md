# Tasks

## 1. 目标版依赖与本地验收边界

- [x] 1.1 将 `@deepseek-ai/dsh-agent`、`@deepseek-ai/dsh-storage-domain` 及新增的客户端 dsh 契约包精确锁定到 `0.2.0-rc.2`，对齐 Schemastery/Cordis peer graph 并运行 `pnpm install`，验证 lockfile 中 `dsh-telegram` 不再解析旧版 dsh 核心包
- [x] 1.2 将插件进入 `1.x` 映射版本线并声明精确 `engines.dsh`，更新 `package.json#dsh.client.inject`，删除已不存在的 `@deepseek-ai/dsh-client-runtime` 并声明 Settings、Plugin Manager、Workspace 与 Remote 所需注入，验证版本后缀、兼容字段和每个 manifest 包都与目标版依赖图一致
- [x] 1.3 增加 package 契约测试，直接导入目标版 `installModelSelection`、storage domain API 和客户端依赖的公开 exports，运行 `pnpm -F @implementsio/dsh-telegram test` 验证不存在依赖旧内部路径的导入
- [x] 1.4 为验收流程增加“禁止 publish”检查或可审计步骤，确认实施与验收命令不包含 `npm publish`、`pnpm publish` 或从 registry 安装待发布插件版本

## 2. Loader 配置与 Runtime 生命周期

- [x] 2.1 将 Telegram `Config` 的在线可编辑字段迁移为 dsh `0.2.0-rc.2` Loader volatile 配置，并让 Host `apply(ctx, config)` 直接消费该配置；增加配置 schema 测试验证默认值、约束和 volatile metadata
- [x] 2.2 移除 `ctx.settings.register/get/watch`，在 Settings 可用时登记 `auto: false` 页面策略，并监听 scoped `loader/volatile-update`；用 Host 契约测试验证初始启用、配置更新和禁用分别触发正确协调动作
- [x] 2.3 实现 generation-aware 串行 runtime 协调器，保证每轮先完成旧 runtime 清理再启动最新配置，并在启动失败后保持可重试；用可控异步 runtime 测试验证连续更新不并发启动、不遗留中间 generation
- [x] 2.4 监听 `DSH_TELEGRAM_BOT_TOKEN` 的 `credentials/reference-updated` 并接入同一协调器，忽略其他凭据更新；测试 Token-only 更新会重建一次、旧客户端先停止、无关 ref 不重建
- [x] 2.5 将插件卸载接入协调器的 disposal barrier，阻止排队中的旧 generation 再次启动；测试卸载会等待在途 stop/start 收敛且最终没有活动 runtime

## 3. dsh 0.2.0-rc.2 Plugin Manager 配置页

- [x] 3.1 移除 `settingsScope`，以 `@implementsio/dsh-telegram#dsh-telegram` 注册 `plugins.row.config`，直接消费 Plugin Manager 提供的 `ConfigPageForm { state, mutate }` owner prop；增加客户端契约测试验证 row key 和 summary/page 均可渲染
- [x] 3.2 将设置卡适配新版 ConfigPageForm state、`ctx.workspaces.list` 和 row page 的 `view` 契约，保留 Workspace 选项、可写状态和脱敏凭据展示；用组件或 controller 测试覆盖 loading、ready、readonly、summary 与 page 状态，并用真实浏览器验证折叠卡展开后字段完整
- [x] 3.3 将普通配置保存改为一次带当前 revision 的 `form.mutate` 原子操作，删除逐字段 `scope.set` 及先禁用再写回流程；测试多个字段只产生一次 mutation，revision 冲突会刷新并提示且不会静默覆盖
- [x] 3.4 保持 credentials 位置参数与 `RemoteResult` 契约，按“写 Token → 重读 configured → 原子提交启用配置”执行；扩展客户端凭据测试验证 Token 失败、状态未确认和配置 mutation 失败均不泄露 Token、不错误启用
- [x] 3.5 更新客户端 esbuild 包装和 external/import 约束，运行 `pnpm -F @implementsio/dsh-telegram build` 后验证生成的 `lib/client.js` 可由 dsh `0.2.0-rc.2` ModuleLoader 加载且不引用旧服务名或旧 slot

## 4. Durable Agent Preset 组合

- [x] 4.1 抽取创建侧 preset composition：先 resolve preset 并持有 revision lease，再将同一 ID 写入 `meta.agentPreset` 和 setup 的 `mount`；测试 metadata、mount 参数一致，成功或失败后 lease 都被释放
- [x] 4.2 为恢复路径注入并使用官方 Session Query/Projection，读取 `agentPreset` 当前 projection 后 resolve/mount 历史 preset；测试 Host 默认 preset 改变后 resume 仍使用 Session 原 preset
- [x] 4.3 实现旧 Session 无 preset 记录的默认 preset 回落，以及历史 preset 不可用时的脱敏失败与既有绑定失效重建策略；测试两种路径都不会挂载未验证的 preset，重建 Session 会记录新的实际 preset
- [x] 4.4 保持 live Agent 复用路径不重复 mount，只补装 Telegram bridges 和模型 selection，并用目标版 composed preset/projection 契约验证一致性；运行相关 runtime 测试确认流式事件、审批和提问 bridge 不重复注册

## 5. 完整模型选择与存储兼容

- [x] 5.1 将模型选择归一化、binding schema、live ref 和 `agentOptions` 扩展为可选 `reasoningEffort`，并确保 `/model <provider> <model>` 切换时清除旧模型 effort；扩展模型命令测试验证创建、恢复、切换和全局默认回落的完整快照
- [x] 5.2 保持 `telegram_bindings` domain version 1，不配置无效的 single-layout compatible version；运行持久化测试验证旧 `{sessionId, workspaceId, provider?, model?}` 记录可读，新记录可往返 reasoning effort，旧 schema 可忽略新增字段
- [x] 5.3 回归 Workspace 切换、`/new`、resume 失败重建和 runtime 重启路径，运行 `model-command.test.js` 与 `persist.test.js` 验证完整选择不丢失且从不写入全局默认设置

## 6. 文档与子系统回归

- [x] 6.1 更新 `packages/plugins/dsh-telegram/README.md`，说明插件版本、dsh `0.2.0-rc.2` 最低兼容边界、Plugin Manager row 配置位置、单一 bundle patch 启动方式及成套回滚要求，并逐条验证文档命令与当前 CLI help 一致
- [x] 6.2 更新 README 的数据兼容说明，明确 binding 无迁移、optional reasoning effort 和历史 preset 缺失/不可用处理；用 `openspec validate upgrade-dsh-telegram-for-dsh-vnext --strict` 验证规范与实现文档没有冲突
- [x] 6.3 运行 `pnpm -F @implementsio/dsh-telegram test`，修复所有 Host、客户端、preset、模型、流式输出、审批/提问、Workspace 和媒体回归，确保测试全绿且不触发真实 Telegram 网络请求

## 7. web profile 与局域网集成验收

- [x] 7.1 运行 `pnpm -F @implementsio/dsh-telegram test` 与 `pnpm -F @implementsio/dsh-telegram build`，确认本地 `lib/client.js` 为最新构建产物；同时记录 link 前 web profile 的 `package.json`、lockfile（若存在）及 `@implementsio/dsh-telegram` 解析状态
- [x] 7.2 在 web profile 停止状态下执行 `dsh plugin --profile web link <dsh-telegram绝对路径>`，验证 `@implementsio/dsh-telegram` 实际解析到当前仓库目录且未执行任何 publish 或 registry 插件安装
- [x] 7.3 在不使用真实 Token 的情况下运行 `dsh --profile web --dump-config`，验证 linked 包的 `dsh.bundle.patch` 使 `dsh-telegram` 仅注册一次、Config schema 可解析、客户端依赖图可装载；再验证额外传同一 patch 会产生重复 row，并由验收检查主动拒绝启动而非依赖 dsh 拒绝
- [x] 7.4 动态探测当前受信私有 LAN 的非 loopback IPv4；经用户明确批准后创建不落库的临时 overlay，将 webserver 短时绑定到 `0.0.0.0`，以 `dsh --profile web --patch <overlay> --port 3080 --trusted-host <lan-ip>:3080 --no-open` 启动；从同一 LAN 设备访问并验证 token/authority 防护，确认未配置公网转发
- [x] 7.5 到达人工凭据门槛后暂停自动验收，由用户在本机 loopback Plugin Manager 中手动填写测试 Bot Token、Owner ID、Workspace 和可选 Proxy并启用插件；用户确认后验证 Token 未进入聊天、命令、profile patch 或测试日志
- [x] 7.6 在用户完成配置后验证 Plugin Manager row 能读取 Workspace 与脱敏 Token 状态、原子保存普通配置，并验证配置冲突和缺 Token 启用均给出脱敏反馈
- [x] 7.7 使用测试 Bot 真机验证首次启动、普通配置更新、Token-only 更新和禁用期间始终最多一个 polling 客户端，且文本流、`/new`、`/workspace`、`/model`、审批、提问和图片交付无回归
- [x] 7.8 用现有 `telegram_bindings` 文件副本和目标版 Session 副本验证旧绑定无需迁移、历史 preset 能恢复、缺失或已删除 preset 按规范降级，并确认工作目录没有新增状态文件
- [x] 7.9 停止 LAN Web 进程并删除临时 all-interface overlay，执行 `dsh plugin --profile web unlink @implementsio/dsh-telegram` 并与 link 前记录比较，验证只撤销本次验收变更且不覆盖其他 profile 配置或依赖
- [x] 7.10 运行仓库 `pnpm lint`、`pnpm format` 和 `openspec validate upgrade-dsh-telegram-for-dsh-vnext --strict`，确认代码质量与 OpenSpec 严格校验通过；确认验收完成时仍未发布插件，发布留给独立后续流程

## Workflow follow-up

- 完成评审和真机验收后，将增量规范同步并归档该 change。
- 如需发布，在归档与发布审批后启动独立发布流程；本 change 的 apply/验收不执行发布。
