## 1. Go 工程骨架

- [x] 1.1 在 `go/` 下创建 `go.mod`，module path 为 `implements.io/projectv`
- [x] 1.2 创建目录结构：入口 `go/cmd/artusx-api/`；业务 `go/internal/artusx-api/{config,handler,middleware,telegram,view/template}`（社区惯例 cmd + internal 布局）
- [x] 1.3 确认 `pnpm-workspace.yaml` 的 glob 不会扫到 `go/`；如需要在 `.gitignore` 忽略 Go 构建产物（如二进制、`*.test`）
- [x] 1.4 添加 echo 依赖，写最小 `main.go`（监听 7001，`GET /` 返回占位），验证 `go build ./...` 与本地运行

## 2. 配置与基础设施

- [x] 2.1 实现 `config/config.go`：从 `WEBHOOK_AUTH_TOKEN`、`BOT_AUTH_TOKEN`、`TELEGRAM_CHANNEL_INFO`、`TELEGRAM_CHANNEL_IDEA` 读取配置
- [x] 2.2 在 `main.go` 配置 CORS 中间件（方法 `GET,HEAD,PUT,POST,DELETE,PATCH`；来源用白名单或不携带凭证的 `*`，修正原 Node 版非法组合，见 design 决策 6）
- [x] 2.3 用 `embed` 嵌入 `view/` 模板，启动时 `html/template` 预编译

## 3. 只读路由迁移

- [x] 3.1 将 `index.html` 由 Nunjucks 改写为 `html/template` 语法，核对渲染输出
- [x] 3.2 实现 `handler/home.go`：`GET /`（渲染 index.html）、`GET /Robots.txt`（纯文本 `User-agent: * / Disallow: /`）
- [x] 3.3 实现 `handler/api.go`：`GET /api`（渲染 index.html）；确认不实现 `GET /api/strategies`
- [x] 3.4 本地验证三个只读路由响应正确

## 4. Webhook 与鉴权

- [x] 4.1 实现 `middleware/auth.go`：校验 query `token` 是否等于 `WEBHOOK_AUTH_TOKEN`，缺失/为空/不符均返回 403
- [x] 4.2 改写 `template/madrid.html`、`template/info.html` 为 Go 模板语法
- [x] 4.3 实现 `telegram/bot.go`：基于 Bot API 客户端的 `SendMessage(chatID, htmlText)`（`parse_mode=HTML`，纯文本，无图片）
- [x] 4.4 实现 `handler/webhook.go`：`POST /webhook/madrid`、`/info`（渲染模板→推 info channel）、`/idea`（message 非空→推 idea channel），均返回 `done`，Bot API 失败记日志不吞错
- [x] 4.5 在 echo 中以 group 方式将 auth 中间件挂到 `/webhook/*`
- [x] 4.6 用样例 body 验证三个 webhook 的鉴权、模板渲染与推送

## 5. 工程化：CI / 提交钩子

- [x] 5.1 引入 golangci-lint 配置，确认 `gofmt`/`golangci-lint` 本地可运行
- [x] 5.2 修改 husky pre-commit：仅当 staged 含 `*.go` 时运行 Go 格式化与 lint，不影响 TS-only 提交
- [x] 5.3 新增 Go CI workflow（`actions/setup-go` + `go build ./...` + `go test ./...`），与既有 Node CI 解耦
- [x] 5.4 确认既有 `ci.yml` 与 `docker-artusx-api.yml` 行为未受影响

## 6. 容器化与并存部署

- [x] 6.1 编写 Go 版多阶段 Dockerfile（builder 编译静态二进制 → distroless/scratch 运行）
- [x] 6.2 新增 Go 版独立 docker workflow，镜像 tag 为 `suyi/artusx-api-golang:latest`，与 Node 版 `suyi/artusx-api:latest` 隔离
- [x] 6.3 编写/更新 Go 版 README（本地运行、并存端口映射说明）
- [x] 6.4 独立部署 Go 版（对外映射非 7001 端口），与 Node 版并行验证 webhook 推送 —— **待运维执行**（需真实 registry + bot token + 部署环境）

## 7. 收尾与校验

- [x] 7.1 为 handler / middleware / bot 补充单元测试（鉴权分支、模板渲染、推送错误处理）
- [x] 7.2 运行 `openspec validate --change migrate-artusx-api-to-go-echo --strict` 通过
- [x] 7.3 补充 CLAUDE.md 的 Go 应用规范（echo、目录约定、gofmt/golangci-lint、node: 前缀不适用等）
- [x] 7.4 确认 Telegram bot 已加入 info/idea channel 且具备发帖权限（运维前提）—— **待运维执行**
