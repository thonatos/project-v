## Context

`artusx-api` 是 monorepo（pnpm workspace）中一个基于 ArtusX（Node/TS 依赖注入 + 装饰器路由）的服务，承担了 Web API、Telegram 推送、爬虫、定时任务多种职责，运行时依赖沉重（Puppeteer、MTProto、ClickHouse、Redis、sharp）。经确认，真正需要迁移的只有其中**独立且仍在使用的 Web/Webhook 层**；爬虫（`module-news/*`，现状 `enable:false`）、MTProto 用户客户端、ClickHouse 查询均不迁移。

约束：
- 仓库以 pnpm 为骨架（`oxlint`/`oxfmt`/husky/commitlint），Go 有独立工具链，两者是平行体系。
- CLAUDE.md 规定所有操作限于项目根目录内。
- 迁移期两版**并存**，旧 Node 版继续运行未迁移职责。

## Goals / Non-Goals

**Goals:**
- 在 monorepo 中确立一套隔离、可复用的 Go 工程结构（`go/` + 单 `go.mod`）。
- 用 echo 实现 Go 版 `artusx-api`，覆盖首页/robots/`/api`/`/webhook/*` + token 鉴权。
- Telegram 推送由 MTProto 简化为 Bot API。
- 产出最小化容器镜像（distroless/scratch 单二进制）。

**Non-Goals:**
- 不迁移爬虫、定时任务、MTProto、ClickHouse、Redis、sharp、socketio、openai。
- 不删除或改动旧 Node 版 `artusx-api` 及其 Docker CI。
- 不实现 `GET /api/strategies`。
- 不引入 `go.work` 多 module（单 module 已足够，预留未来演进）。

## Decisions

### 决策 1：目录结构用「独立 `go/` 目录 + 单一 go.mod」

```
go/
├── go.mod              module implements.io/projectv
├── cmd/
│   └── artusx-api/     ← 应用入口 + 部署产物
│       ├── main.go     config.Load → 装配 → 启动
│       ├── Dockerfile
│       ├── .env.example
│       └── README.md
└── internal/
    └── artusx-api/     ← 该服务私有业务包
        ├── config/    config.go
        ├── handler/   home.go  api.go  webhook.go
        ├── middleware/ auth.go
        ├── telegram/  bot.go
        └── view/      index.html  template/{madrid,info}.html
```

**理由**：单 module 内部包可直接 import，零额外配置，上手成本最低；`go/` 顶层目录与 `packages/` 平级，pnpm 的 glob（`packages/apps/*`）天然扫不到，隔离干净。module path 定为 `implements.io/projectv`（本次业务包即 `implements.io/projectv/internal/artusx-api/*`）。布局遵循 Go 社区惯例 **`cmd/`（薄入口）+ `internal/`（本 module 私有业务/共享代码）**——**不引入 `apps/` 或 `service/` 层**。入口在 `go/cmd/artusx-api/`，其默认二进制名 `artusx-api` 落地 `go/artusx-api`；因 `go/` 顶层无同名目录，`go build ./cmd/<app>`（即便不带 `-o`）与 `go build ./...` 均无落地冲突。多应用虽同处一个 module，但各自独立部署——`go build ./cmd/<app>` 只编译该入口及其实际依赖。跨服务共享代码同样放 `internal/`（可另置 `internal/shared` 等子目录区分）。
**备选**：(a) `go.work` 多 module——各服务依赖版本/发布强隔离，但现阶段只有一个服务、依赖无需隔离，属过度设计；待将来确有隔离需求时，单 module → go.work 多 module 可平滑升级。(b) 顶层平铺 `go/<svc>/`（main 包直接在此）——目录名与默认二进制名相同，`go build ./<svc>` 不带 `-o` 会因输出路径 `go/<svc>` 撞目录而报错；`cmd/` 布局天然规避，故否决平铺。(c) `apps/` 或 `service/` 包裹层——非 Go 社区惯例、且属多余层级，否决。(d) 把 Go 塞进 `packages/apps/artusx-api`——会让 `pnpm -r build`/oxlint 与 go.mod 打架，否决。

### 决策 2：Web 框架用 echo

**理由**：用户倾向，且 echo 的路由/中间件/group 模型能一对一映射 ArtusX 的 `@Controller`/`@MW`；`/webhook` 用 echo group 挂 auth 中间件，语义比原装饰器更直接。
**备选**：gin（生态更大但 API 风格差异大）、标准库 `net/http`+chi（更轻但要手写更多）。echo 在「贴近原结构 + 轻量」间平衡最好。

### 决策 3：依赖注入改为「手动构造注入」

ArtusX 的 `@Inject` 容器在 Go 里用**显式构造**替代：`main.go` 构造 config、bot client，注入到各 handler struct。
**理由**：迁移范围小（3 类 handler + 1 中间件 + 1 bot），手动注入最直白、可测试；无需引入 `google/wire` 等 DI 工具。
**备选**：wire——对当前规模是额外复杂度，否决。

### 决策 4：模板 Nunjucks → `html/template`

`index.html`、`template/madrid.html`、`template/info.html` 改写为 Go 模板语法，启动时 `template.ParseGlob` 预编译，用 `embed` 打进二进制（利于 distroless 镜像）。
**理由**：标准库零依赖，`embed` 让镜像不必单独拷模板文件。
**风险**：Nunjucks 与 Go 模板语法不同（`{{ x }}` vs `{{ .X }}`、过滤器、autoescape 行为），需逐个模板核对渲染结果。

### 决策 5：Telegram 用 Bot API

用轻量 Bot API 客户端（如 `github.com/go-telegram/bot`）实现 `SendMessage(chatID, htmlText, parse_mode=HTML)`。webhook 三接口均只发纯文本（原 body 未传 thumb），故**无需**实现图片/sharp 逻辑。
**理由**：Bot API 是 HTTP 调用，比 MTProto 用户客户端简单一个数量级，无 session 迁移问题。
**前提**：bot 需被加入目标 channel 并有发帖权限。

### 决策 6：修正 CORS 配置（不照搬原有非法组合）

原 Node 版 CORS 为 `origin:* + credentials:true`，此组合浏览器不接受（携带凭证时通配来源会被拒）。Go 版**借机修正**：保留方法集 `GET,HEAD,PUT,POST,DELETE,PATCH`，但改用显式允许来源白名单（或不携带凭证的 `*`），使配置在浏览器端合法。
**理由**：照搬一个本就无效的配置没有价值；迁移是修正它的自然时机。
**影响**：这是 Go 版与原 Node 版行为的一处**有意偏离**，需在 README 注明；若确有依赖凭证的跨域调用方，需提供确切来源以配置白名单。

### 决策 7：Go 版镜像 tag 与 Node 版隔离

Go 版镜像 tag 定为 `suyi/artusx-api-golang:latest`（Node 版为 `suyi/artusx-api:latest`），独立 docker workflow 构建，互不覆盖。

### Webhook 处理时序

```
Client                echo(:7001)         auth MW          handler         Telegram Bot API
  │  POST /webhook/info?token=xxx │            │               │                  │
  │──────────────────────────────▶│            │               │                  │
  │                                │──检查token─▶│               │                  │
  │                                │            │ token 不符 →403│                  │
  │                                │◀───403─────│               │                  │
  │                                │  token 通过 │               │                  │
  │                                │────────────┼──────────────▶│                  │
  │                                │            │  html/template │                  │
  │                                │            │  渲染 body      │                  │
  │                                │            │               │──sendMessage────▶│
  │                                │            │               │  (失败→记日志)   │
  │◀──────────── "done" ───────────┼────────────┼───────────────│                  │
```

## Risks / Trade-offs

- **模板语法差异导致渲染错位** → 迁移时逐模板对比 Nunjucks 与 Go 输出，用真实/样例 body 验证。
- **Bot 无 channel 发帖权限，推送静默失败** → 上线前确认 bot 已加入 info/idea channel 且为管理员；handler 对 Bot API 错误记日志（不静默吞错）。
- **Bot API 与 MTProto 消息呈现差异**（发送者显示为 bot、HTML 支持子集不同）→ 用 `parse_mode=HTML` 并核对 madrid/info 模板中的 HTML 标签是否在 Bot API 支持范围内。
- **两版同端口 7001 本地冲突** → 并存靠部署侧端口映射；本地同时起两版时需手动改其一端口，文档注明。
- **husky pre-commit 引入 Go 检查拖慢提交** → 仅当 staged 存在 `*.go` 时才运行 gofmt/golangci-lint，TS-only 提交不受影响。
- **CORS 修正改变对外行为** → Go 版不再照搬 `origin:*+credentials:true`（见决策 6）；若有依赖旧行为的跨域凭证调用方，迁移前需收集其来源加入白名单。

## Migration Plan

1. **骨架**：建 `go/go.mod`（module `implements.io/projectv`）、`go/cmd/artusx-api/` 与 `go/internal/artusx-api/` 目录；echo 起一个 `/` 返回占位，验证 `go build ./...` 与本地运行。
2. **只读路由**：迁 `/`、`/Robots.txt`、`/api` + `html/template` + CORS。
3. **Webhook**：迁 auth 中间件 + 三个 webhook 路由 + Bot API 推送；用样例 body 验证渲染与发送。
4. **工程化**：Go CI workflow（setup-go + build + test）、husky pre-commit Go 检查、Go 版 Dockerfile（多阶段 + distroless）、独立 docker workflow。
5. **并存验证**：Go 版独立部署（映射非 7001 对外端口），与 Node 版并行观察 webhook 推送。

**回滚**：停 Go 版容器，流量回 Node 版；代码回退仅删 `go/` 与新增的 Go CI/Docker workflow，不触及 pnpm 世界与旧服务。

## Open Questions

- 若有依赖旧 CORS 行为（携带凭证的跨域调用）的实际客户端，需收集其确切来源以配置白名单（见决策 6）；目前假设无此类调用方。
- Go 版对外服务端口的映射值（并存期非 7001）由部署侧最终确定。
