# Proposal

## Why

Vela 当前通过 GitHub Releases 分发完整 macOS 应用，但用户只能手动发现、下载并覆盖安装新版本，安全修复和协议兼容更新难以及时到达已安装设备。Vela 的 Rust host、Go Core 与 TSX UI 必须作为一个兼容单元升级，因此需要在现有可验证发布链上增加完整 `.app` 自动更新能力，而不是只更新 NSH UI 包。

## What Changes

- 仅为 macOS Vela 集成固定版本的 Sparkle 2，更新整个 `Vela.app`；iOS 保持现状。
- 在应用菜单提供“检查更新…”，默认进行低打扰的后台检查，并使用 Sparkle 原生界面完成版本说明、下载、验证、安装与重启交互。
- 自动更新首期仅提供稳定通道；不做静默强制安装、delta update 或 NSH `.nshpkg` UI OTA。
- 更新安装必须进入 Vela 的正式退出路径，在有界清理共享、映射、私人连接和 `vela-core` helper 后再替换应用并重启。
- 在现有 GitHub Release ZIP 上增加 Sparkle EdDSA 签名，并从标准发布元数据派生稳定 appcast；只有维护者将 Draft Prerelease 人工公开后，该版本才可进入稳定更新 feed。
- 更新发布门禁，校验 Sparkle 依赖来源、嵌套 bundle 签名、appcast、版本/build、资产签名及从旧版到新版的真实安装与重启路径。
- 继续明确披露当前 ad-hoc、未公证状态；Sparkle 的 EdDSA 更新签名不得被表述为 Apple Developer ID 签名或公证。

## Capabilities

### New Capabilities

- `vela-macos-auto-update`: 定义 macOS Vela 的更新发现、用户交互、安全验证、安装重启、失败恢复和首期范围边界。

### Modified Capabilities

- `vela-release-distribution`: 扩展现有 Release 契约，增加 Sparkle 固定工具链、EdDSA 更新签名、公开发布后生成稳定 appcast，以及更新资产的验证要求。

## Impact

- 影响 `packages/apps/vela/macos/host` 的 AppKit 生命周期、原生菜单和退出协调。
- 影响 `packages/apps/vela/scripts/build-app.sh`、`macos/app/Info.plist`、发布脚本、发布文档及 `.github/workflows/vela-release.yml`。
- 新增固定版本的 Sparkle 2 二进制依赖和独立保管的 EdDSA 发布私钥；公钥随应用交付，私钥仅在受信任发布阶段使用。
- 更新行为不经过 Go Core，也不改变 Vela 设备协议、配置格式或 iOS 运行路径。
- 这是向后兼容的用户功能，营销版本按 SemVer 评估为 MINOR；实施时 macOS/iOS 版本来源与 Apple build number 仍须按现有 Vela 规则同步递增。

## Rollback Plan

- 若自动更新发布链异常，停止或回退稳定 appcast，使已安装版本不再发现问题版本；保留 GitHub Release 的手动下载与校验路径。
- 若某个公开版本有缺陷，发布更高 build 的修复版本，不通过降低 appcast 版本实施降级。
- 若应用内集成不稳定，后续完整版本可移除自动检查入口和 Sparkle 组件；用户配置、Tailscale 身份及现有 Release 格式保持可用。
- 已经开始替换应用时由 Sparkle 保证安装事务与失败恢复，Vela 不自行实现覆盖或删除 `/Applications/Vela.app`。
