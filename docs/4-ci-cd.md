# 4. CI / CD

## 4.1 触发路径

| workflow | 触发 | 路径过滤 | 主要 job |
| --- | --- | --- | --- |
| `nodejs-ci.yml` | push / PR `main` | 无 | `build`：`pnpm check`、`pnpm test`、`pnpm -r --filter '!vela' build` |
| `golang-ci.yml` | push / PR `main` | `go/**` | `build`：gofmt、vet、build、test（Go 1.26） |
| `docker-artusx-api.yml` | push `main` | 无 | `docker`：构建并推送 `packages/apps/artusx-api` 镜像 |
| `docker-artusx-api-go.yml` | push `main` | `go/**` | `docker`：构建并推送 `go/cmd/artusx-api` 镜像 |
| `gitleaks.yml` | push / PR `main` | 无 | `scan`：密钥扫描 |
| `vela-ci.yml` | push / PR `main` | `packages/apps/vela/**`、根 `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、Vela 相关 workflow 与 action | `verify-macos`：macOS arm64 验证 |
| `vela-release.yml` | tag `vela-v*` | — | 校验 tag 与版本、构建 macOS 应用、生成资产、Draft Prerelease |
| `vela-update-feed.yml` | `release: published` | — | 在受保护 environment 中校验公开稳定 Release、attestation 与 EdDSA 签名，并原子推进稳定 feed |

`nodejs-ci` 的 `pnpm check` 覆盖 `packages/**` 的格式、lint 与类型检查；`pnpm test` 只运行根 `vite.config.ts` 声明的三个项目（`i18n-studio`、`gpm`、`dsh-telegram`）。

## 4.2 门禁矩阵

| 改动路径 | 本地专项门 | CI 覆盖 |
| --- | --- | --- |
| `packages/**`（JS/TS） | `pnpm check`、`pnpm test`、`pnpm -r build` | `nodejs-ci` → `build` |
| `go/**` | `gofmt -l .`、`go vet ./...`、`go build ./...`、`go test ./...` | `golang-ci` → `build` |
| `packages/apps/artusx-api/**` | `pnpm -F artusx-api build` | `nodejs-ci`；push `main` 触发 `docker-artusx-api` |
| `go/cmd/artusx-api/**` | `go build ./...` | `golang-ci`；push `main` 触发 `docker-artusx-api-go` |
| `packages/apps/vela/**` | `pnpm -F vela verify` | `vela-ci` → `verify-macos` |
| tag `vela-v*` | `node scripts/release/check-version.mjs --tag vela-vX.Y.Z`、`pnpm -F vela verify:release` | `vela-release` |
| 公开 Vela Release / stable feed | `pnpm -F vela test:release`；目标 macOS 双 build 更新验收 | `vela-update-feed` → `publish-stable-feed` |
| 任意提交 | — | `gitleaks` → `scan` |

Vela 的 iOS 构建、签名、Simulator 与真机验收不在 CI 中执行，见 `packages/apps/vela/AGENTS.md`。

`vela-release` 的 tag 构建不读取更新私钥，只创建 Draft Prerelease 和带 attestation 的不可变资产。`vela-update-feed` 仅在人工公开 Release 后运行；生产私钥只进入 `vela-stable-updates` environment 的 feed job，job 不 checkout 仓库源码，只消费已证明的发布资产和固定摘要的 Sparkle 工具。

## 4.3 覆盖缺口

这些是当前事实，不是待办清单；相关 change 需要决定“新增 gate”还是“记录缺口”。

- `docs-app`、`remix-api`、`remix-flow`、`i18n-studio`、`react-app` 没有部署 gate：构建由 `nodejs-ci` 聚合覆盖，部署是手动 `wrangler deploy` 或 Docker。
- `packages/apps/artusx-api` 的镜像在每次 push `main` 时重建，没有 `paths` 过滤。
- Docker 镜像只在 push `main` 构建，PR 不验证 Dockerfile。
- `packages/apps/vela/core` 是独立 Go module，不在 `golang-ci` 的 `go/**` 路径内；它的 Go 测试由 `vela-ci` 覆盖。
- `@implementsio/dsh-telegram` 没有发布 workflow；`prepublishOnly` 只在手动发布时跑测试。
- `docs/` 的语义一致性没有自动检查（按设计不引入自研检查器），由 change 的归档核对承担。

## 4.4 部署目标

| 目标 | 方式 | 触发 |
| --- | --- | --- |
| Cloudflare Workers | `pnpm -F <pkg> deploy`（`wrangler deploy`） | 手动：`docs-app`、`remix-api`、`remix-flow` |
| 阿里云镜像仓库 | GitHub Actions 构建并推送 `:latest` | push `main`：`artusx-api`（Node / Go） |
| 自托管 Docker | 构建镜像后部署 | 手动：`i18n-studio` |
| GitHub Releases | tag `vela-v*` → Draft Prerelease → 人工公开 | 手动打 tag |
| Vela stable appcast | 公开稳定 Release → 校验、签名 → `vela-updates` 分支 | `release: published` |
| npm | `pnpm -F dsh-telegram publish` | 手动 |
| 本地 | `pnpm -F <pkg> build` / `scriptc` | 手动：`react-app`、`gpm`、`react-component` |
