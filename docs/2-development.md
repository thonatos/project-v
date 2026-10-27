# 2. 开发

## 2.1 工具链

| 工具 | 版本 | 来源 |
| --- | --- | --- |
| Node.js | `>=24.11`（CI 使用 24） | `README.md`、`.github/workflows/nodejs-ci.yml` |
| pnpm | `12.14.0` | 根 `package.json` 的 `packageManager` |
| Vite+ | `1.3.0` | `pnpm-workspace.yaml` 的 catalog |
| Go（根 module） | `1.26` | `go/go.mod`、`golang-ci.yml` |
| Go（Vela core） | `1.27.2` | `packages/apps/vela/core/go.mod` |
| Rust（Vela） | `1.98.1` | `packages/apps/vela/rust-toolchain.toml` |
| NSH | `v0.2.0` | `packages/apps/vela/.nsh-version` |
| macOS / Xcode | macOS 14+，配套 Command Line Tools | `packages/apps/vela/docs/development.md` |

`go/` 与 `packages/apps/vela/core` 是两个独立 Go module，版本要求不同，不要用一条全局 Go 版本覆盖两者。

## 2.2 安装与初始化

```bash
pnpm install          # 安装 workspace 依赖，并执行 prepare 安装 Vite+ git hooks
```

Vela 额外需要 NSH、Rust 与 NSH 源码 checkout（Rust crate 需要）：

```bash
NSH_VERSION=v0.2.0 curl -fsSL https://nsh.dev/install.sh | sh
git clone --depth 1 --branch v0.2.0 https://github.com/longbridge/nsh ~/.nsh/source
export NSH_SOURCE="$HOME/.nsh/source"
```

Go 依赖：

```bash
cd go && go mod download
cd packages/apps/vela/core && go mod download
```

完整 Vela 前置条件与漂移校验见 `packages/apps/vela/docs/development.md`。

## 2.3 常用命令

根目录：

| 命令 | 作用 |
| --- | --- |
| `pnpm check` | `vp check packages`：格式、lint、类型检查 |
| `pnpm lint` / `pnpm lint:fix` | 仅 lint |
| `pnpm format` / `pnpm format:write` | 仅格式检查 / 写入 |
| `pnpm test` | `vp test run`，运行 i18n-studio、gpm、dsh-telegram 的测试项目 |

按包运行（完整脚本以各包 `package.json` 为准）：

```bash
pnpm -F <pkg> dev
pnpm -F <pkg> build
pnpm -F <pkg> typecheck
pnpm -F <pkg> run          # 列出该包全部脚本
```

- `docs-app` / `react-app` / `i18n-studio` / `remix-api` / `remix-flow`：React Router 或 Wrangler 命令。
- `artusx-api`：`tsc` 构建 + 复制视图到 `dist/`。
- `go/`：`gofmt -l .`、`go vet ./...`、`go build ./...`、`go test ./...`、`golangci-lint run ./...`（v2，配置 `go/.golangci.yml`）。
- `vela`：`sh scripts/nsh.sh check macos/ui/App.tsx`、`pnpm -F vela test`、聚合入口 `pnpm -F vela verify`。完整列表见 `pnpm -F vela run` 与包内 `docs/development.md`。
- `gpm`：`scriptc` 构建原生二进制，`pnpm -F gpm test`。
- `dsh-telegram`：`pnpm -F dsh-telegram test`，发布前 `prepack` 会生成客户端与 patch。

## 2.4 环境变量

| 位置 | 变量 | 说明 |
| --- | --- | --- |
| `packages/apps/i18n-studio` | `SESSION_SECRET` | 认证会话密钥；构建期校验非空且非默认值 |
| `packages/apps/i18n-studio` | `STUDIO_BASE_URL`、`STUDIO_NAMESPACE`、`STUDIO_WRITE_TOKEN` | 仅 `i18n:push` / `i18n:pull` 同步脚本使用，见 `.env.example` |
| `go/cmd/artusx-api` | `PORT`、`WEBHOOK_AUTH_TOKEN`、`BOT_AUTH_TOKEN`、`TELEGRAM_CHANNEL_INFO`、`TELEGRAM_CHANNEL_IDEA` | 缺省端口 `7001`；同目录 `.env` 会被自动加载且不覆盖真实环境变量，见 `.env.example` |
| `packages/apps/remix-api` / `remix-flow` | Cloudflare bindings 与 secrets | 以各自 `wrangler.jsonc` 与部署侧配置为准 |
| `packages/apps/vela` | `NSH_SOURCE` | NSH Rust crate 的源码 checkout 路径，未设置时回退 `~/.nsh/source` |
| Vela CI | `VELA_BUILD_DIR`、`VELA_ARTIFACT_DIR`、`VELA_REPORT_DIR` | 由 workflow 指定到包内 `.tmp/`，不要在本地复用 |

`data/i18n.db` 已加入该应用的 `.gitignore`；`.env` 不提交。
