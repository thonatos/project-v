# Go Agent Guidelines

本文件适用于 `go/**`，在仓库根 `AGENTS.md` 之上补充 Go module 规则。`packages/apps/vela/core` 是另一个 module，不适用本文件，规则见 Vela 的 `AGENTS.md`。

## 边界

- module path：`implements.io/projectv`，Go 版本以 `go/go.mod` 为准（当前 `1.26`）。
- 目录遵循 Go 社区惯例：入口在 `go/cmd/<app>/`，业务与共享包在 `go/internal/<app>/`。
- **没有 `apps/`，没有 `service/` 层**；不要为了对称添加空层。
- 拥有：`go/cmd/artusx-api`、`go/internal/artusx-api/**`、`go/.golangci.yml`。
- 不拥有：Vela core、根 Node/TS 工具链。
- 上述 TypeScript / React / Node.js 规范（`docs/7`）不适用于本目录。

## 本地约束

- Web 框架用 **echo**；依赖注入用**手动构造注入**，不引入 wire 等 DI 框架。
- 模板用标准库 `html/template` + `go:embed`，不用 Nunjucks。
- Telegram 用 **Bot API**（标准库 `net/http` 直调），不用 MTProto。
- 配置从环境变量读取（`internal/artusx-api/config/config.go`）；监听端口默认 `7001`，并存期由部署侧做端口映射。
- 错误显式处理并 `%w` 包装；不 silent failure。
- 格式化用 `gofmt`；静态检查用 `golangci-lint` v2（配置 `go/.golangci.yml`）。

## 验证入口

在 `go/` 中运行：

| 变更类型 | 命令 | 期望结果 |
| --- | --- | --- |
| 格式化 | `gofmt -l .` | 输出为空 |
| 静态检查 | `go vet ./...` | 退出码 0 |
| 编译 | `go build ./...` | 退出码 0 |
| 测试 | `go test ./...` | 全部通过 |
| Lint（需安装 v2） | `golangci-lint run ./...` | 退出码 0 |

## CI 映射

| 路径 / 事件 | workflow | 必过门 |
| --- | --- | --- |
| `go/**` | `golang-ci.yml` → `build` | gofmt、vet、build、test |
| push `main` 且 `go/**` 变更 | `docker-artusx-api-go.yml` → `docker` | 构建并推送镜像 |

PR 不验证 Dockerfile；镜像只在 push `main` 时构建。

## 发布与验收

- 包版本不构成交付契约（见 `docs/5.2`）；镜像固定 `:latest`。
- 部署后确认 `PORT`、webhook token 与 Telegram channel 配置生效；回滚方式为重新部署上一版镜像 digest，见 `docs/5.4`。
