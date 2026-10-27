# Tasks

## 1. 固定 Sparkle 工具链与供应链门禁

- [x] 1.1 在 Vela 发布工具链声明中固定 Sparkle `2.10.1` 官方发行 URL、SHA-256 和所需文件清单，扩展准备与检查脚本，并以正确摘要、错误摘要和非预期归档内容 fixture 验证 fail-closed 行为。
- [x] 1.2 为本地与 CI 准备无真实私钥的 Sparkle 测试工具/签名 fixture，确保缓存路径位于 Vela 受控目录，并通过 `node tests/release-toolchain.test.mjs` 验证普通验证 job 不读取更新 secret。
- [x] 1.3 在 `.github/actions/vela/setup-toolchain/action.yml` 中接入固定 Sparkle 缓存和校验，更新 workflow policy 测试以约束下载先校验后执行、Action 固定 SHA 和只读权限，并运行 `node tests/release-workflows.test.mjs`。

## 2. 组装可更新的完整 macOS 应用

- [x] 2.1 扩展 `scripts/build-app.sh`，把固定 Sparkle framework 和必要 helper 按官方目录结构复制到 `Vela.app`、保留 symlink/权限、配置 host rpath，并明确由内向外执行 ad-hoc 签名；通过 `sh tests/release/macos-release.test.sh` 验证组装结构。
- [x] 2.2 更新 `macos/app/Info.plist`，加入生产稳定 feed URL、Sparkle EdDSA 公钥和低打扰自动检查配置，同时保持 bundle id、最低系统版本及 Apple build 契约；通过 plist fixture 测试确认公钥/feed 存在且未声明 Developer ID 或公证。
- [x] 2.3 扩展 `scripts/release/macos-check-app.sh`，校验 Sparkle framework/helper、Mach-O 架构、rpath、symlink、执行权限、嵌套签名和完整应用签名，并让构建目录及 ZIP 解压目录执行同一检查；运行 `sh tests/release/macos-release.test.sh` 覆盖篡改与缺失组件失败场景。

## 3. Native updater 与应用生命周期

- [x] 3.1 在 `macos/host` 增加最小 Sparkle Objective-C FFI 和唯一 updater owner，初始化 `SPUStandardUpdaterController` 并暴露只触发手动检查的语义 native 命令；用 Rust 单元/契约测试验证 owner 生命周期、重复初始化和命令转发。
- [x] 3.2 将 TSX “Vela”应用菜单接入“检查更新…”语义命令，不在 UI/store 中复制 feed、文件或安装状态，并用 NSH macOS 交互测试验证菜单可见、可访问且每次选择只触发一次检查。
- [x] 3.3 重构 AppKit 正式终止协调，使 `Cmd+Q`、Dock 退出和 Sparkle 安装退出统一在有界关闭共享、映射、连接、NSH view 与 `vela-core` 后终止，同时保持关闭窗口只隐藏；用 Rust 生命周期测试与现有 `macos-smoke-app.sh` 验证超时、隐藏/恢复和无残留 helper。
- [x] 3.4 增加 updater 错误/不可写位置的脱敏诊断与手动 Release 回退链接，确保不记录凭据、认证 URL、Cookie 或业务内容，并以 host 测试验证失败保留当前运行实例及可执行恢复动作。

## 4. 生成与验证稳定 appcast

- [x] 4.1 实现独立的 feed 组装/验证工具：读取公开 Release 的 `release.json`、ZIP 和 release notes，从 ZIP `Info.plist` 提取并交叉校验 bundle id、营销版本、Apple build 和最低系统版本，再生成单一最新稳定条目的 `appcast.xml`；用 fixture 覆盖合法、版本漂移、大小/摘要错误、错误平台和非递增 build。
- [x] 4.2 使用 Sparkle `sign_update` 对下载到的同一 ZIP 生成 EdDSA 签名，并在 feed 验证器中校验 URL、长度、签名和归档身份一致；用测试密钥证明篡改 ZIP、错误公钥和缺失签名均被拒绝。
- [x] 4.3 实现 `vela-updates` 分支 feed 发布器，以当前 ref SHA 做 compare-and-swap、重复版本幂等退出、较低/equal build 拒绝，并通过 mock GitHub API 集成测试验证创建分支、原子推进、并发冲突和失败保留旧 feed。
- [x] 4.4 更新 `docs/release.md`，说明应用内更新、安全边界、首个迁移版本、稳定 feed 发布、私钥操作、暂停 feed 和更高 build 修复流程；人工核对文档命令与 feed 验证工具的 CLI 一致。

## 5. 公开 Release 后的最小权限发布流程

- [x] 5.1 新增只响应 `release.published` 的 Vela feed workflow，拒绝 draft/prerelease/错误 tag，且不 checkout 或执行仓库代码；通过 workflow policy 测试验证固定 Action、专用 environment、最小 `contents`/attestation 权限及 secret 只存在于签名发布 job。
- [x] 5.2 让 feed workflow 下载公开 Release 的标准资产、验证 Artifact Attestation 与清单、执行 EdDSA 签名和 feed 组装，再通过 Git Data API 原子更新 `vela-updates` ref；用 fixture 和 dry-run 验证发布前 Draft workflow 不改变 feed、任何验证失败也不改变旧 ref。
- [x] 5.3 扩展 Vela CI 路径和聚合发布测试，使新增 workflow、脚本、plist、Sparkle bundle 与文档纳入对应 common/macos/release gates，并运行 `pnpm -F vela test:release` 验证完整发布策略。

## 6. 版本迁移与端到端验收

- [x] 6.1 将 Vela 营销版本同步提升到 `0.3.0`、Apple build 同步提升到 `3`，更新全部 macOS/iOS 正式版本来源和 `releases/0.3.0.md`，并运行 `node shared/ui/version.test.mjs` 与 `node scripts/release/check-version.mjs --tag vela-v0.3.0`。
- [x] 6.2 在隔离 feed/本地 HTTPS fixture 中用 updater-capable 旧 build 验证无更新、发现更高 build、版本说明、推迟、下载失败、签名篡改、只读位置和退出时安装，保存明确区分 fixture 与产品页面的验收证据。
- [x] 6.3 在目标 macOS 的 `/Applications` 中以两个真实完整 build 验证有活动共享/映射时安装、三秒有界清理、旧 `vela-core` 不残留、整个 app 替换、relaunch、bundle 版本、配置及 Tailscale 身份保留，并记录 ad-hoc/Gatekeeper 的实际行为而不将其描述为 Developer ID 或公证结果。
- [x] 6.4 运行 `pnpm -F vela verify` 和 `pnpm -F vela verify:release`，确认 common、macOS、发布及更新专项门禁全部通过；按 Vela 规则记录 iOS 未实现更新且未进行真机/Simulator 更新验收。

## Workflow follow-up

- 在评审确认密钥管理、目标 macOS 实测证据和发布回退演练后归档 change。
- 提交并推送归档结果，等待 GitHub Actions 通过后创建 `vela-v0.3.0` tag；tag workflow 仅创建 Draft Prerelease。
- 维护者人工核对资产、签名、证明与说明后公开 Release，再确认 `release.published` workflow 原子推进生产稳定 feed。
