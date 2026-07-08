# artusx-api (Go)

基于 [echo](https://echo.labstack.com/) 的 `artusx-api` Go 版本，是原 Node/ArtusX 版 `packages/apps/artusx-api` 的 **Web/Webhook 服务层**迁移产物。

## 迁移范围

**已迁移**：首页与静态文本路由、`/api` 首页、经 token 鉴权的 `/webhook/{madrid,info,idea}`（模板渲染 + Telegram **Bot API** 推送）。

**未迁移 / 已移除**：爬虫（`module-news`）、定时任务、Telegram MTProto 用户客户端、ClickHouse（含 `GET /api/strategies`）、Redis、sharp 等——这些仍保留在旧 Node 版中。

## 目录结构

```
go/                              module implements.io/projectv
├── cmd/
│   └── artusx-api/              入口 + 部署产物
│       ├── main.go              echo 启动 + 路由 + CORS + 依赖装配
│       ├── Dockerfile           多阶段构建 → distroless
│       ├── .env.example         配置模板
│       └── README.md
└── internal/
    └── artusx-api/              该服务私有业务包
        ├── config/              环境变量配置
        ├── handler/             home / api / webhook 处理器
        ├── middleware/          webhook token 鉴权
        ├── telegram/            Bot API 客户端（标准库 net/http）
        └── view/                go:embed 内嵌并预编译的 HTML 模板
```

> 布局遵循 Go 社区惯例：`cmd/<app>` 放薄入口，`internal/` 放本 module 私有代码
> （单服务业务与跨服务共享包均在此，共享包可另置 `internal/shared` 等）。

## 本地运行

推荐用 `.env`（服务启动时自动加载同目录下的 `.env`）：

```bash
cd go/cmd/artusx-api
cp .env.example .env        # 首次:复制模板并填入真实值
cd ../..                    # 回到 go/
go run ./cmd/artusx-api
```

> `.env` 从**运行时工作目录**加载。上面在 `go/` 下运行，故 `.env` 需放 `go/`；
> 若想让 `.env` 留在入口目录，则 `cd go/cmd/artusx-api && go run .`。

或直接用环境变量（CI/生产方式）：

```bash
cd go
WEBHOOK_AUTH_TOKEN=xxx \
BOT_AUTH_TOKEN=xxx \
TELEGRAM_CHANNEL_INFO=@your_info_channel \
TELEGRAM_CHANNEL_IDEA=@your_idea_channel \
go run ./cmd/artusx-api
```

服务监听 `:7001`。真实环境变量优先级高于 `.env`（`.env` 只补充未设置的项）。

> **并存说明**：Go 版与旧 Node 版端口同为 `7001`。本地同时运行两版时，需手动为其一设置不同 `PORT`（如 `PORT=7002`）；生产环境由部署侧做端口映射区分。

## 环境变量

| 变量 | 用途 |
|---|---|
| `PORT` | 监听端口，缺省 `7001` |
| `WEBHOOK_AUTH_TOKEN` | `/webhook/*` 的 query `token` 校验值 |
| `BOT_AUTH_TOKEN` | Telegram Bot API token |
| `TELEGRAM_CHANNEL_INFO` | madrid / info 接口推送目标 channel |
| `TELEGRAM_CHANNEL_IDEA` | idea 接口推送目标 channel |

## 构建

```bash
cd go
go build ./...                       # 编译检查（cmd/internal 布局，无同名冲突）
go build -o bin/artusx-api ./cmd/artusx-api  # 产出二进制到 go/bin/（已 gitignore）
go vet ./...                         # 全量静态检查
go test ./...                        # 单元测试
gofmt -l .                           # 格式检查
golangci-lint run ./...              # lint（需安装 golangci-lint v2）
```

## 容器构建

构建上下文为**仓库根目录**（Dockerfile 需读取 `go/go.mod`）：

```bash
docker build -f go/cmd/artusx-api/Dockerfile -t artusx-api-golang .
```

产物为 distroless 静态镜像，镜像 tag（CI 推送）：`suyi/artusx-api-golang:latest`。

## 运维前提

Webhook 推送依赖 Telegram Bot：需将 bot（`BOT_AUTH_TOKEN` 对应）加入 `info` / `idea` 目标 channel，并授予**发帖权限**（管理员）。这是与旧版 MTProto 用户身份的关键差异。

## CORS 说明

Go 版**修正**了旧版 `origin:* + credentials:true` 的非法组合（浏览器会拒绝携带凭证的通配来源），改为不携带凭证的通配来源。若有依赖凭证的跨域调用方，需改为显式来源白名单。
