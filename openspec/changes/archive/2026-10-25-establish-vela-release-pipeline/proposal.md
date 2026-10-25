# Proposal

## Why

Vela 目前缺少覆盖 macOS 的持续集成和可追溯的 GitHub Release 流程，现有产物只有本机 ad-hoc 签名，版本、最低系统版本与构建来源也没有统一发布门禁。需要在不依赖付费 Apple Developer 账户的前提下，先建立可信、可验证且可扩展到未来 Linux Node 的发布基础设施。

## What Changes

- 新增 Vela 独立 CI，在固定的 macOS arm64 环境中验证 NSH、Rust、Go Core、应用组装和生命周期。
- 新增 `vela-vX.Y.Z` 标签驱动的 GitHub Release 流程，发布 ad-hoc 签名的 Apple Silicon macOS 桌面应用。
- 将 tag、应用清单、共享版本常量和 bundle 元数据纳入统一版本校验。
- 检查 App 内所有 Mach-O 的架构、最低系统版本、bundle 标识与 ad-hoc 签名，修复当前 `vela-core` 实际最低系统版本高于声明值的问题。
- 生成版本化 ZIP、`SHA256SUMS`、平台无关的 `release.json` 和 GitHub Artifact Attestation。
- Release 默认创建为 Draft 和 Prerelease，由维护者人工确认后发布，并明确说明 Gatekeeper 的首次运行步骤和未公证状态。
- 发布契约按组件、平台和架构建模，为未来 `Vela-Node-*-linux-{x86_64,arm64}.tar.gz` 预留扩展位；本次不实现 Linux Node。

## Capabilities

### New Capabilities

- `vela-release-distribution`: 定义 Vela 的持续验证、版本化发布资产、平台元数据、构建来源证明和无 Developer ID 的 macOS 安装说明。

### Modified Capabilities

- 无。

## Impact

- 影响 `.github/workflows/` 下的 Vela CI 与发布编排。
- 影响 `packages/apps/vela/scripts/` 中的 macOS 构建、发布验证、打包和发布元数据生成脚本。
- 影响 Vela 的版本一致性检查、macOS deployment target 配置和发布文档。
- CI 将下载并校验固定版本的 NSH macOS arm64 发行包，同时将 NSH 源码固定到对应 tag 的 peeled commit。
- GitHub Actions 需为发布 job 提供最小化的 `contents: write`，为证明 job 提供 `id-token: write` 与 `attestations: write`；普通构建 job 保持只读。
- 当前只发布 macOS arm64；Linux Node（CLI + 内嵌 Web UI、localhost/显式 `0.0.0.0`、Caddy/Nginx 负责 TLS）仅作为后续兼容约束。

## Rollback Plan

- 删除或禁用新增的 Vela CI/Release workflow，即可恢复为现有本地构建流程。
- 发布流程默认只创建 Draft/Prerelease；验证失败或资产有误时删除草稿 Release 和对应 tag，不影响已发布代码。
- deployment target 或打包调整若导致回归，可恢复原构建脚本；已存在的本地开发与 iOS 构建入口保持不变。
- `release.json` 从 schema version 1 开始，若后续不采用该契约，可停止生成而不影响 Vela 运行时协议和用户数据。
