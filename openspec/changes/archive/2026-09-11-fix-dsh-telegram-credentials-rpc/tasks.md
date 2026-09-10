## 1. 插件注册与启动说明

- [x] 1.1 新增或更新 `dsh-telegram` 当前使用说明，明确已安装到 profile 后直接使用 `dsh web`，不得再叠加同一 `cordis.patch.yml`
- [x] 1.2 说明显式 `--patch` 仅适用于目标 profile 未安装插件的隔离开发模式，并保持 `package.json#dsh.bundle.patch` 与 `cordis.patch.yml` 作为发布注册入口
- [x] 1.3 使用 `dsh --profile web --dump-config` 验证常规安装模式最终只包含一个 `id: dsh-telegram`，并记录重复 patch 的失败验证

## 2. Credentials RPC 适配

- [x] 2.1 将 Telegram 设置页接入 `ctx.remote.credentials`，使用 `describe(refs)` 位置参数，并从当前 `RemoteResult.value` 的引用映射读取脱敏状态
- [x] 2.2 将 Bot Token 保存改为 `set(ref, value)` 位置参数，显式检查失败结果，并在重新启用 runtime 前刷新并确认 `configured`
- [x] 2.3 区分读取与写入阶段的失败反馈，保留安全兜底文案，确保错误、日志和 UI 状态不包含 Bot Token

## 3. 客户端契约测试

- [x] 3.1 增加 credentials describe 测试，断言引用数组参数、成功映射和未配置状态
- [x] 3.2 增加 credentials set 测试，断言 `ref`/`value` 位置参数、写入后状态刷新以及失败时不重新启用 runtime
- [x] 3.3 增加失败与脱敏测试，覆盖 `{ ok: false }` 和调用异常，并断言错误输出不包含提交的 Secret

## 4. 构建与验证

- [x] 4.1 运行插件客户端构建，确保 `lib/client.js` 与 `src/client.js` 的修复一致
- [x] 4.2 运行 `pnpm -F @implementsio/dsh-telegram test`，确认全部插件测试通过
- [x] 4.3 在 dsh `0.1.5-rc.1` 设置页验证 `DSH_TELEGRAM_BOT_TOKEN` 状态请求成功、Token 可保存且页面不再显示错误提示
- [x] 4.4 检查工作区差异，确认没有改动已有凭据文件、Token 引用名或无关 Telegram runtime 行为

## 5. 出站兼容与发布

- [x] 5.1 在流式事件未交付正文时，从 Session 最终 assistant 消息补发文本，并避免与正常流式正文重复
- [x] 5.2 增加缺失事件兜底和正常流式不重复的回归测试
- [x] 5.3 将插件版本提升为 `0.3.1`，将 `node-telegram-bot-api` 精确升级到 `2.1.0`，并记录新增 API 暂不改变现有交付语义
- [x] 5.4 统一 patch 生成脚本的单引号格式，避免 `prepack` 产生纯格式差异
- [x] 5.5 重新运行插件测试、构建、pack 检查和 OpenSpec 验证
