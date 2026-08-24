## Why

DeepSeek Harness 目前缺少一个可直接通过 Telegram 私聊驱动的轻量插件。插件通过 `node-telegram-bot-api` 接入单个 Bot，同时避免复制 `dsh-im` 的多渠道、多 Bot 架构。

## What Changes

- 新增一个 Telegram 插件，支持单个 Bot 通过 Bot API long polling 接收和发送私聊消息。
- 新增 Bot Token、绑定 Workspace 和可选协议的 Proxy 配置；Bot Token 接入 Harness credentials 机制。
- Proxy 通过 Bot SDK 的可注入 fetch transport 使用，协议、地址和端口必填，用户名和密码可选。
- 将单个 Telegram Bot 持久绑定到一个 Workspace；Telegram 私聊到 Harness Session 的持久化路由只能创建和恢复该 Workspace 下的 Session。
- 新增 `ownerUserId` 私聊访问限制，首版只允许一个 Telegram 用户驱动该 Bot。
- 新增 `/new`、`/status`、`/stop`、`/help` 等基础命令，以及受 Harness 命令系统约束的命令转发。
- 控制命令走独立 fast path，并以请求 ownership 和 Turn 状态校验为前提停止或纠偏当前任务，不依赖 Telegram runtime 自建的活动状态猜测。
- 新增 Harness 审批和用户问题交互；Telegram 优先使用 inline keyboard card 呈现选项、审批和状态，回调失败时降级为受控文字回复。
- 新增明确的出站消息类型映射：文本使用可编辑文本消息，图片、音频、视频和文件使用 Telegram 原生媒体消息，工具执行使用状态 card，审批和用户问题使用交互 card；同时支持图片 caption、长消息分片和消息编辑式流式回复。
- 新增可配置的出站消息长度上限，默认遵循 Telegram `sendMessage` 的 4096 字符限制，并在发送前按配置值安全分片。
- 明确首版不处理群组、频道和多 Bot 管理。
- 配置变更时停止旧连接并重建 Telegram runtime；启动失败不得静默吞错。

## Capabilities

### New Capabilities

- `telegram-private-chat`: 通过单个 Bot API 客户端将 Telegram 私聊与 Harness Session 双向连接。

### Modified Capabilities

无。

## Impact

- 在 `packages/plugins/dsh-telegram/` 新增 Telegram 插件源码、内置 Settings 配置声明和测试；测试阶段直接加载该目录中的真实 Cordis patch 文件。
- 使用 dsh 内置 Settings UI 渲染配置项和状态，不新增自定义 React 设置页或独立 UI 组件。
- 新增固定依赖 `node-telegram-bot-api@2.0.0`，以及 SOCKS5 Proxy 所需的运行时适配。
- 依赖 Harness 的插件生命周期、Settings、Credentials、Workspace、Agent/Session、Command 和事件接口。
- 不修改现有渠道的行为。
- 不要求在测试前发布 npm 包或执行本地 link；本地 Cordis patch 是开发期注入路径，当前 CLI 使用 `pnpm dsh --profile web --patch ./packages/plugins/dsh-telegram/cordis.patch.yml`。
- 回滚方案：禁用或卸载该插件，停止 Telegram runtime 并删除其配置和 Session 路由；现有 Harness Session 和其他插件不受影响。
