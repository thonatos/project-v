# Vela 开发环境

Vela 的构建工具和网络依赖必须使用以下精确版本，以避免 NSH runtime、Rust 宿主与 Go Core 之间发生不可复现的漂移：

| 工具或依赖 | 版本 |
|---|---|
| macOS | 14.0 或更高版本 |
| Xcode Command Line Tools | 与当前 macOS SDK 配套的稳定版本 |
| NSH CLI 与 runtime | `v0.1.1` |
| Rust | `1.98.1` |
| Go | `1.27.2` |
| `tailscale.com` / `tsnet` | `v1.104.1` |
| NSH Rust crates | crates.io `=0.1.1`；NSH 生成 workspace 由 `NSH_SOURCE` patch 到 tag revision `21101386fb4e7fd8d1ded3b740c5756240181d0e` |

## 安装 NSH

NSH 不进入 npm 依赖。使用官方安装器安装与 `.nsh-version` 一致的版本：

```sh
NSH_VERSION=v0.1.1 curl -fsSL https://nsh.dev/install.sh | sh
```

项目脚本优先使用 `PATH` 中的 `nsh`，否则使用 `~/.nsh/bin/nsh`。脚本不会自动下载或升级工具。

## 验证依赖

在 `packages/apps/vela` 中运行：

```sh
cargo metadata --locked --format-version 1 --no-deps
go mod download -C core
pnpm run check
```

`Cargo.lock` 与 `core/go.sum` 必须随依赖变化一起提交。NSH 的发行 runtime 由固定版本安装器管理，其版本记录在 `.nsh-version`。

## 发布前验证

在 `packages/apps/vela` 中运行唯一的发布前命令：

```sh
pnpm run verify:release
```

该命令依次验证协议文档、用户文档、UI 状态 fixture、视觉 token、桌面结构、NSH typecheck、Rust format/test/clippy、Go race、系统网络隔离以及全新目录中的 App 组装和嵌套签名。日志和临时 App 仅写入本项目的 `.tmp/release/` 与 `.tmp/release-build/`，不会成为正式 fixture。
