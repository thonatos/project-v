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
| Sparkle                   | `2.10.1` 官方发行归档；版本、URL、SHA-256 与所需路径见 `scripts/release/toolchain.json`                                                                                 |

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

组装 macOS `Vela.app` 还需要已校验的 Sparkle 发行目录。CI 通过 `prepare-ci-toolchain.sh` 下载后先校验 SHA-256 与必需路径，再导出 `SPARKLE_HOME`；本地可复用同一入口，且安装目录必须位于 Vela `.tmp/`：

```sh
sh scripts/release/prepare-ci-toolchain.sh "$PWD/.tmp/toolchain"
export NSH_SOURCE="$PWD/.tmp/toolchain/nsh-source"
export SPARKLE_HOME="$PWD/.tmp/toolchain/sparkle"
```

不得从未经摘要验证的归档复制 framework 或执行 `sign_update`。生产 Sparkle 私钥不进入本地工具链目录、仓库或普通 CI。

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

它依次验证结构契约、协议与用户文档、状态/异步 headless tests、capabilities、两端 NSH runtime 语义测试与 typecheck、iOS 依赖边界、Rust format/test/clippy、Go race 与系统网络隔离。

发布前再跑一次发布门，它在该入口之上追加两端组包与签名：

```sh
pnpm run verify:release
```

只验证并打包 GitHub Release 使用的 macOS arm64 资产时运行：

```sh
pnpm run verify:macos-release
```

该入口固定 deployment target 为 macOS 14，检查 App 内每个 Mach-O 的架构、最低系统版本与 ad-hoc 签名，校验 Sparkle framework/helper/rpath，运行隔离生命周期和更新菜单 smoke，并在 ZIP 解压后复验完整性。下载验证、自动更新、Gatekeeper 和 GitHub Release 说明见 `release.md`。

日志和临时 App 仅写入本项目的 `.tmp/release/`、`.tmp/release-build/` 与 `.tmp/ios-derived/`，不会成为正式 fixture。iOS 未设置 `DEVELOPMENT_TEAM` 时按未签名构建。
