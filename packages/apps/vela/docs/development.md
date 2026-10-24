# Vela 开发环境

Vela 的构建工具和网络依赖必须使用以下精确版本，以避免 NSH runtime、Rust 宿主与 Go Core 之间发生不可复现的漂移：

| 工具或依赖                | 版本                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS                     | 14.0 或更高版本                                                                                                                                                         |
| Xcode Command Line Tools  | 与当前 macOS SDK 配套的稳定版本                                                                                                                                         |
| NSH CLI 与 runtime        | `v0.2.0`                                                                                                                                                                |
| Rust                      | `1.98.1`                                                                                                                                                                |
| Go                        | `1.27.2`                                                                                                                                                                |
| `tailscale.com` / `tsnet` | `v1.104.1`                                                                                                                                                              |
| NSH Rust crates           | crates.io `=0.2.0`（`nsh-core`、`nsh-platform-macos`、`nsh-base`）；NSH 生成 workspace 由 `NSH_SOURCE` patch 到 tag revision `669b62b11449b2ab787b7c82649a392cbff25b8f` |

## 安装 NSH

NSH 不进入 npm 依赖。使用官方安装器安装与 `.nsh-version` 一致的版本：

```sh
NSH_VERSION=v0.2.0 curl -fsSL https://nsh.dev/install.sh | sh
```

项目脚本优先使用 `PATH` 中的 `nsh`，否则使用 `~/.nsh/bin/nsh`。脚本不会自动下载或升级工具。

带 Rust crate 的构建还需要 `NSH_SOURCE` 指向与 `.nsh-version` 同 tag 的 NSH 源码 checkout；发行安装器不包含源码，需要单独检出（脚本在未设置 `NSH_SOURCE` 时会回退到 `~/.nsh/source`）：

```sh
git clone --depth 1 --branch v0.2.0 https://github.com/longbridge/nsh ~/.nsh/source
export NSH_SOURCE="$HOME/.nsh/source"
```

## 验证依赖

在 Vela 根目录中运行：

```sh
cargo metadata --locked --format-version 1 --no-deps
go mod download -C core
pnpm run check
```

`Cargo.lock` 与 `core/go.sum` 必须随依赖变化一起提交。NSH 的发行 runtime 由固定版本安装器管理，其版本记录在 `.nsh-version`。

Go Core 是单一模块（`core/`）：`cmd/vela-core` 是 macOS 入口，`cmd/vela-mobile` 是 iOS 的 c-archive 入口，共享实现位于 `internal/core`，macOS 编排位于 `internal/app`，C ABI 位于 `internal/iosabi`。常用命令：

```sh
go build -C core ./...
go test -C core -race ./...
go list -C core -deps ./cmd/vela-mobile   # 检查 iOS 的依赖边界
```

## 验证与发布

在 Vela 根目录中运行唯一的聚合验证入口：

```sh
pnpm run verify
```

它依次验证结构契约、协议文档、用户文档、两端 UI 投影与 typecheck、iOS 依赖边界、Rust format/test/clippy、Go race 与系统网络隔离。

发布前再跑一次发布门，它在该入口之上追加两端组包与签名：

```sh
pnpm run verify:release
```

日志和临时 App 仅写入本项目的 `.tmp/release/`、`.tmp/release-build/` 与 `.tmp/ios-derived/`，不会成为正式 fixture。iOS 未设置 `DEVELOPMENT_TEAM` 时按未签名构建。
