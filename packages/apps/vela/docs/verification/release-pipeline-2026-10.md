# Vela Release 流水线验收（2026-10）

## macOS CI

- GitHub Actions run：`40166114778`，attempt 1 与 attempt 2 均成功。
- 环境：GitHub-hosted `xcode-27`、arm64。
- 覆盖：固定工具链、共享门、macOS 门、真实 App 构建、Mach-O/minOS/ad-hoc 签名、隔离生命周期 smoke、ZIP 上传。
- 缓存复验：attempt 2 命中内容寻址缓存；日志确认缓存恢复后仍重新校验 NSH 归档，并验证 NSH source commit 为 `669b62b11449b2ab787b7c82649a392cbff25b8f`。

## 测试 Release

- 测试 tag：`vela-v0.1.0`。
- GitHub Actions run：`40170805086`，完整流程与幂等重跑均成功。
- Release 状态：Draft、Prerelease，未自动公开。
- 资产：
  - `Vela-Desktop-0.1.0-macos-arm64.zip`
  - `SHA256SUMS`
  - `release.json`
  - `release-notes.md`
- SHA-256：从 run 下载资产后执行 `shasum -a 256 -c SHA256SUMS` 通过。
- Artifact Attestation：`gh attestation verify` 通过；证明绑定仓库 `thonatos/project-v`、workflow `vela-release.yml`、测试 tag、GitHub-hosted runner 与对应 ZIP 摘要，并记录于 Sigstore Rekor。
- 幂等性：只重跑 publish job 及依赖后仍保持 Draft Prerelease，资产数保持 4，没有重复文件，也未覆盖公开 Release。

验收完成后删除测试 Draft Release 与 `vela-v0.1.0` 测试 tag；首次正式发布时重新创建指向已确认版本提交的 tag。
