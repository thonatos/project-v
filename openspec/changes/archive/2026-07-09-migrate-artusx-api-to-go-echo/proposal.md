## Why

现有 `artusx-api` 是一个基于 ArtusX（Node/TS 依赖注入 + 装饰器框架）的服务，实际承担了「Web API + Telegram 推送 + 爬虫 + 定时任务」多种职责，运行时依赖沉重（Puppeteer、MTProto 用户客户端、ClickHouse、Redis、sharp），Docker 镜像体积大、启动慢。我们希望将其中**纯粹、独立、仍在使用的 Web/Webhook 服务层**迁移到 Go + echo，获得单静态二进制、极小镜像、秒级启动的收益，并简化 Telegram 集成（用 Bot API 取代 MTProto 用户客户端）。

## What Changes

- 在 monorepo 中新增 Go 工程骨架（`go/` 目录，单一 `go.mod`），与现有 `packages/` 的 pnpm 世界平级、互不干扰。
- 基于 **echo** 框架新建 Go 版 `artusx-api`（入口 `go/cmd/artusx-api/`、业务 `go/internal/artusx-api/`，采用社区惯例的 `cmd/` + `internal/` 布局，无 `apps/`/`service/` 包裹层），迁移以下 HTTP 能力：
  - `GET /`、`GET /Robots.txt`（首页模板 + 纯文本）
  - `GET /api`（首页模板）
  - `POST /webhook/madrid`、`POST /webhook/info`、`POST /webhook/idea`（模板渲染后推送 Telegram）
  - webhook 的 token 鉴权中间件（校验 query `token`）
- Telegram 推送方式变更：**BREAKING**（对运维而言）——由 MTProto 用户客户端改为 **Telegram Bot API**，需要目标 channel 将 bot 加为具备发帖权限的管理员。
- 模板引擎由 Nunjucks 改为 Go 标准库 `html/template`（`index.html`、`template/madrid.html`、`template/info.html` 需改写语法）。
- **不迁移 / 移除范围**（保留在旧 Node 版，或直接废弃）：
  - 爬虫相关 `module-news/*`（`news.service`、`news.schedule`、`rili.schedule`）——现状 `enable: false`。
  - MTProto 用户客户端 `service/telegram.ts` 及其图片处理（sharp）。
  - ClickHouse 相关：`service/strategy.ts` 及 `GET /api/strategies` 接口一并删除（Go 版不实现）。
  - 插件依赖：pptr / clickhouse / redis / openai / socketio / telegram(MTProto) 均不迁移。
- 并存策略：Go 版与 Node 版**同时保留**，Node 版继续承担爬虫/定时/MTProto 等未迁移职责；Go 版仅提供 Web + Webhook。两者端口均为 `7001`，部署时通过端口映射区分。
- 名称不变：Go 版仍命名为 `artusx-api`（尽管已不再使用 ArtusX 框架）。

## Capabilities

### New Capabilities
- `go-workspace`: 在 monorepo 中引入并规范 Go 工程结构（`go/` 目录、`go.mod`、构建/测试/格式化约定、与 pnpm 世界的隔离边界、CI 与 Docker 集成方式）。
- `go-artusx-api`: Go + echo 版 `artusx-api` 服务，提供首页/静态文本路由、`/api` 首页、以及经 token 鉴权的 `/webhook/*` 接口（模板渲染 + Telegram Bot API 推送）。

### Modified Capabilities
<!-- 无既有 OpenSpec spec 受影响（openspec/specs/ 目前为空），故不涉及既有 capability 的需求变更。 -->

## Impact

- **新增代码**：`go/`（`go.mod`，module path `implements.io/projectv`；入口 `go/cmd/artusx-api/`（main.go/Dockerfile/.env.example/README），业务 `go/internal/artusx-api/`（config/handler/middleware/telegram/view））。
- **新增依赖**：`github.com/labstack/echo/v4`、一个 Telegram Bot API 客户端库（如 `github.com/go-telegram/bot`）、配置读取（`viper` 或 `os.Getenv`）。
- **CI/CD**：现有 Node CI（`pnpm -r build`）不会扫描 `go/`，天然隔离；需**新增** Go 的 CI（`go build ./... && go test ./...`）与独立的 Go 版 Docker 构建 workflow（不改动现有 `docker-artusx-api.yml`），Go 版镜像 tag 为 `suyi/artusx-api-golang:latest`。Go 版 Dockerfile 采用多阶段构建 + `distroless`/`scratch`，产出单二进制小镜像。
- **运维前提**：需准备一个 Telegram Bot Token（`BOT_AUTH_TOKEN` 已在旧配置中存在），并将 bot 加入 `news`/`info`/`idea` 对应 channel 且授予发帖权限。
- **环境变量**：Go 版复用 `WEBHOOK_AUTH_TOKEN`、`BOT_AUTH_TOKEN`、`TELEGRAM_CHANNEL_INFO`、`TELEGRAM_CHANNEL_IDEA`、`TELEGRAM_CHANNEL_NEWS`（webhook 仅用到 info/idea）。
- **不影响**：旧 Node 版 `packages/apps/artusx-api/` 代码与其 Docker CI 保持原样继续运行。

## Rollback Plan

- 迁移期为**并存**，旧 Node 版全程在线，Go 版独立部署验证；因此回滚 = 停止/下线 Go 版容器，流量继续回到 Node 版（或不摘除 Node 版流量，Go 版仅作灰度）。
- Go 工程完全隔离在 `go/` 目录，回退代码只需移除该目录与新增的 Go CI/Docker workflow，不触及 pnpm workspace 与既有服务。
- Telegram 侧：若 Bot API 推送出现问题，webhook 流量切回 Node 版（MTProto）即可；bot 的 channel 管理员权限可保留，无破坏性。
