## Why

dsh 更新到 `0.1.5-rc.1` 后出现宿主兼容问题：已安装插件会通过包内 bundle patch 自动注册，旧启动命令再传 `--patch` 会产生重复 loader id；credentials 远程调用也改为位置参数并直接返回 `RemoteResult`，而 `dsh-telegram` 设置页仍使用旧契约；部分 Turn 的最终 assistant 消息已进入 Session，但 agent-scoped `session/event` 未送达，导致 Web 有回复而 Telegram 无正文。需要统一插件注册方式并恢复设置页与出站消息对当前 dsh 的兼容性。

## What Changes

- 将 Telegram 设置页的 `credentials.describe` 与 `credentials.set` 调用适配为当前 dsh 的位置参数契约。
- 按当前 `RemoteResult` 结构读取成功值和失败信息，并直接使用凭据映射中的脱敏状态。
- 保持 Bot Token 仅写入 Harness credentials，客户端不读取或展示 Token 原文。
- 为凭据读取、保存成功及 RPC 失败增加客户端契约回归测试。
- 改善设置页失败反馈，使用户能区分读取失败、写入失败和缺少凭据，同时不泄露敏感值。
- 保留包内 `dsh.bundle.patch` 作为已安装插件的自动注册入口，停止在常规启动命令中重复传入同一 `cordis.patch.yml`。
- 补充启动说明和配置验证，确保最终插件树中只存在一个 `dsh-telegram` loader id。
- 在流式正文缺失时从 Session 最终 assistant 消息补发文本，流式已交付时不重复发送。
- 发布 `0.3.1` 并将 `node-telegram-bot-api` 固定升级到 `2.1.0`（Bot API 10.3）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `telegram-private-chat`: 更新凭据保护与插件启动要求，明确当前 dsh credentials RPC 契约以及单一插件注册来源。

## Impact

- 主要影响 `packages/plugins/dsh-telegram/src/client.js` 及生成的 `lib/client.js`。
- 增加或扩展 `packages/plugins/dsh-telegram/test/` 下的客户端 RPC 契约测试。
- 更新插件使用说明或开发文档中的启动命令；`cordis.patch.yml` 和 `package.json#dsh.bundle.patch` 保持为发布注册机制。
- Telegram runtime 仅增加最终文本交付兜底，不改变 credentials 存储格式、设置命名空间或 Bot Token 引用名 `DSH_TELEGRAM_BOT_TOKEN`。
- 不新增运行时依赖；兼容目标为当前 dsh `0.1.5-rc.1` credentials remote API。
- 回滚时可恢复旧版客户端调用和旧启动说明并重新构建发布产物；已存储凭据仍由 Harness credentials 管理，无需迁移或删除。若恢复显式 `--patch` 启动方式，必须先从 profile 卸载插件，避免重复注册。
