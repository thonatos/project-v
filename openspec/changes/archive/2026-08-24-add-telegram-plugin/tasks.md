## 1. 宿主接口与依赖

- [x] 1.1 核对当前 Harness Host 的插件注册、Settings、Credentials、Workspace、Agent/Session、Command 和事件 API，并记录实际类型与调用方式
- [x] 1.2 在 `packages/plugins/dsh-telegram/` 创建 Telegram 插件目录、入口和 bundle 配置，并将 `packages/plugins/*` 纳入 workspace
- [x] 1.3 添加并锁定 `node-telegram-bot-api@2.0.0` 依赖，确认 Node.js 构建产物可加载 Bot SDK

## 2. Telegram Runtime

- [x] 2.1 实现配置规范化、Bot Token credential 读取和脱敏状态
- [x] 2.2 实现 Bot SDK long polling、身份验证、连接状态和错误处理
- [x] 2.3 将 SOCKS5 配置应用到 Bot SDK fetch transport，并覆盖启动失败场景
- [x] 2.4 实现 `NewMessage` 事件注册、owner 私聊过滤、自身消息过滤和 runtime 停止清理
- [x] 2.5 实现配置变更时的 stop-then-start 生命周期，确保旧客户端不再接收事件

## 3. 会话与消息桥接

- [x] 3.1 实现私聊用户 ID 到 Harness Session ID 的持久化绑定及原子更新
- [x] 3.2 实现 Bot Workspace 绑定校验、该 Workspace 下的 Session 创建、已有 Session 恢复和失效绑定处理
- [x] 3.3 实现普通文本入站、`/new`、`/status`、`/stop`、`/help` 命令
- [x] 3.4 对未支持的 `/` 命令返回明确提示，拒绝任意代码、Shell 执行和未定义的 Harness 命令转发
- [x] 3.5 实现图片及 caption 的入站下载、`ctx.attachments` 输入映射和媒体大小校验
- [x] 3.6 实现 Harness 图片产物的出站读取、发送及 caption 映射
- [x] 3.7 实现普通消息与控制命令 fast path 分离、请求 ownership、Turn 校验和可保留 inbox 的 `/stop`
- [x] 3.8 实现 Harness 增量输出、消息 ID 绑定、编辑式流式回复和安全分片
- [x] 3.9 实现文本、图片、音频、视频、文件、工具状态、工具结果和工具错误到 Telegram 原生消息/card 的类型映射
- [x] 3.10 实现 Harness 审批和用户问题队列，主动接管 interaction 并通过 Telegram inline keyboard card 回写答案
- [x] 3.11 处理 Telegram API 错误、限流、编辑失败、媒体交付失败、interaction 过期和 Harness 任务失败，并输出用户可理解的脱敏提示

## 4. 内置 Settings 与宿主接入

- [x] 4.1 注册 dsh 内置 Settings schema，支持启用状态、owner、绑定 Workspace、Proxy 和 `messageLimit` 配置
- [x] 4.2 接入 Bot Token credential 更新流程，界面不暴露内部 credential reference
- [x] 4.3 接入 Host 启动、停用、配置更新和进程关闭生命周期

## 5. 测试与验证

- [x] 5.1 为配置校验、凭据脱敏、SOCKS5 Proxy 和 Session 绑定编写单元测试
- [x] 5.2 为私聊过滤、Workspace 绑定、命令 fast path、消息类型映射、图片 caption、消息长度配置、消息分片、流式编辑和 Telegram card 回调编写模拟客户端测试
- [x] 5.3 为启动、恢复、配置重建、停止、断线重连、Turn ownership 和 interaction 生命周期编写 runtime 测试
- [x] 5.4 从 `packages/plugins/dsh-telegram/` 生成本地插件构建产物，确认 `cordis.patch.yml` 可被 dsh web 解析
- [x] 5.5 使用 `pnpm dsh --profile web --patch ./packages/plugins/dsh-telegram/cordis.patch.yml` 启动本地 dsh web，确认无需 npm publish 或本地 link 即可加载插件
- [x] 5.6 通过本地 patch 加载的真实 Bot 私聊验证登录、Workspace 绑定、`/new`、普通消息、图片 caption、图片发送、回复编辑和 `/stop`
- [x] 5.7 运行插件测试、构建、patch 集成验证和仓库 lint，确认无凭据进入日志或产物
