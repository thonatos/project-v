## ADDED Requirements

### Requirement: 首页与静态文本路由

Go 版 `artusx-api` SHALL 基于 echo 提供首页与 robots 文本路由，行为与原 Node 版一致。

#### Scenario: 访问首页
- **WHEN** 客户端请求 `GET /`
- **THEN** 服务 SHALL 使用 `html/template` 渲染 `index.html`（含标题与欢迎信息）并返回 HTML

#### Scenario: 访问 robots
- **WHEN** 客户端请求 `GET /Robots.txt`
- **THEN** 服务 SHALL 返回纯文本内容 `User-agent: *` 与 `Disallow: /`

#### Scenario: 访问 /api 首页
- **WHEN** 客户端请求 `GET /api`
- **THEN** 服务 SHALL 渲染并返回 `index.html`（首页模板）

### Requirement: 移除 strategies 接口

Go 版 `artusx-api` MUST NOT 实现 `GET /api/strategies` 及任何 ClickHouse 相关能力。

#### Scenario: strategies 接口不存在
- **WHEN** 客户端请求 `GET /api/strategies`
- **THEN** 服务 SHALL 返回 404（该接口不再提供），且服务 MUST NOT 建立任何 ClickHouse 连接

### Requirement: Webhook token 鉴权

Go 版 `artusx-api` SHALL 对所有 `/webhook/*` 接口施加 token 鉴权中间件：校验 query 参数 `token` 是否等于配置的 `WEBHOOK_AUTH_TOKEN`，行为与原 Node 版 `auth.middleware` 一致。

#### Scenario: token 缺失或不匹配
- **WHEN** 请求 `/webhook/*` 且 query `token` 缺失、为空、或与 `WEBHOOK_AUTH_TOKEN` 不一致
- **THEN** 服务 SHALL 返回 `403` 且 MUST NOT 执行后续业务逻辑

#### Scenario: 服务端未配置 token
- **WHEN** `WEBHOOK_AUTH_TOKEN` 未配置（为空）
- **THEN** 所有 `/webhook/*` 请求 SHALL 一律返回 `403`

#### Scenario: token 校验通过
- **WHEN** 请求携带的 `token` 与 `WEBHOOK_AUTH_TOKEN` 完全一致
- **THEN** 中间件 SHALL 放行，交由对应 handler 处理

### Requirement: Webhook 消息推送（Telegram Bot API）

Go 版 `artusx-api` SHALL 提供 `POST /webhook/madrid`、`POST /webhook/info`、`POST /webhook/idea` 三个接口，将请求体经模板渲染后通过 **Telegram Bot API** 以 HTML 模式推送到对应 channel；推送均为纯文本消息（不含图片附件）。

#### Scenario: madrid webhook 推送
- **WHEN** 通过鉴权的 `POST /webhook/madrid` 携带 JSON body
- **THEN** 服务 SHALL 用 `template/madrid.html` 渲染 body，经 Bot API 以 `parse_mode=HTML` 推送到 `info` channel，并返回响应体 `done`

#### Scenario: info webhook 推送
- **WHEN** 通过鉴权的 `POST /webhook/info` 携带 JSON body
- **THEN** 服务 SHALL 用 `template/info.html` 渲染 body，经 Bot API 推送到 `info` channel，并返回 `done`

#### Scenario: idea webhook 推送
- **WHEN** 通过鉴权的 `POST /webhook/idea` 携带包含 `message` 字段的 JSON body
- **THEN** 服务 SHALL 在 `message` 非空时经 Bot API 将其推送到 `idea` channel；无论是否发送，均返回 `done`

#### Scenario: 推送失败不影响响应
- **WHEN** Bot API 调用失败（网络错误、权限不足等）
- **THEN** 服务 SHALL 记录错误日志（不静默吞错），且仍返回 `done`（与原 Node 版容错行为一致）

### Requirement: 配置来源与端口

Go 版 `artusx-api` SHALL 通过环境变量读取配置，监听端口保持 `7001`（并存期由部署侧做端口映射区分），并复用既有环境变量名。

#### Scenario: 端口
- **WHEN** 服务启动
- **THEN** 服务 SHALL 监听 `7001` 端口

#### Scenario: 环境变量复用
- **WHEN** 服务读取配置
- **THEN** 服务 SHALL 从 `WEBHOOK_AUTH_TOKEN`、`BOT_AUTH_TOKEN`、`TELEGRAM_CHANNEL_INFO`、`TELEGRAM_CHANNEL_IDEA` 读取所需配置（channel 仅 webhook 用到 info/idea）

#### Scenario: CORS
- **WHEN** 跨域请求到达
- **THEN** 服务 SHALL 应用合法的 CORS 策略：允许方法 `GET,HEAD,PUT,POST,DELETE,PATCH`，允许来源采用显式白名单或不携带凭证的 `*`（修正原 Node 版 `origin:*+credentials:true` 的非法组合），使浏览器端可正常工作
