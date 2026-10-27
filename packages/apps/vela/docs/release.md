# Vela macOS 发布与安装

Vela 的 macOS 版本通过 GitHub Releases 直接分发，不经过 Mac App Store。当前发布仅支持 Apple Silicon，要求 macOS 14 或更高版本。

## 下载资产

每个 `vela-vX.Y.Z` Release 包含：

```text
Vela-Desktop-X.Y.Z-macos-arm64.zip
SHA256SUMS
release.json
```

- ZIP 是可运行的 `Vela.app`。
- `SHA256SUMS` 用于校验下载内容。
- `release.json` 记录版本、commit、组件、平台、架构、系统要求和签名状态。
- GitHub Artifact Attestation 证明 ZIP 由本仓库的 GitHub Actions 从对应 tag 构建。

## 应用内更新

从 Vela 0.3.0 起，macOS 应用菜单提供“检查更新…”。Sparkle 在第二次启动时按其原生流程询问是否允许后台检查；即使允许，Vela 也不会静默强制安装。发现更新后，用户可以查看版本说明、稍后处理、立即安装并重启，或在正式退出时安装。关闭窗口或 `Cmd+W` 只隐藏 Vela，不会触发安装。

稳定更新源固定为：

```text
https://raw.githubusercontent.com/thonatos/project-v/vela-updates/vela/macos/appcast.xml
```

稳定 feed 只包含最新的已公开、非 Prerelease Vela 版本。Draft Prerelease 不会被已安装客户端发现。0.2.0 及更早版本不含更新器，用户需要手动安装 0.3.0 一次，后续版本才可应用内更新。

应用内更新替换完整 `Vela.app`，包括 Rust host、Go Core、NSH runtime、TSX UI 和资源；Vela 不使用远程 `.nshpkg` 代替完整产品更新。

### 更新信任边界

- Sparkle EdDSA 签名由客户端在解压前验证，用于证明 ZIP 来自持有 Vela 更新私钥的发布者且内容未被篡改。
- `SHA256SUMS` 用于人工下载后的内容校验，GitHub Artifact Attestation 用于验证 GitHub Actions 构建来源；二者不能代替客户端更新签名。
- 当前应用仍是 ad-hoc 签名且未经过 Apple 公证。Sparkle 签名不等于 Developer ID 签名或 Apple 公证，首次安装及某些更新后仍可能需要按下文处理 Gatekeeper。

### 发布稳定 feed

1. `vela-vX.Y.Z` tag workflow 先确认 tag commit 位于 `main` 且同一 SHA 的 Vela CI 已成功，再完成 Release 构建、ZIP 往返校验、Artifact Attestation，并创建 Draft Prerelease；它不重复执行完整 common/macOS 验证。此阶段不读取更新私钥，也不改变稳定 feed。
2. 维护者检查资产和版本说明后手动公开 Release。
3. `release.published` workflow 在受保护的 `vela-stable-updates` environment 中校验公开状态、tag、标准清单、ZIP 摘要、bundle 版本/build 和构建证明。
4. workflow 通过标准输入把 `VELA_UPDATE_PRIVATE_KEY` 交给固定版本的 Sparkle `sign_update`，生成最新稳定 appcast，并以 compare-and-swap 原子推进 `vela-updates` 分支。

生产私钥不得写入仓库、日志、普通 CI 或 Artifact。公钥可公开并嵌入 `Info.plist`。私钥从维护者 Keychain 导出后，通过以下命令写入受保护 environment：

```sh
gh secret set VELA_UPDATE_PRIVATE_KEY \
  --env vela-stable-updates \
  < "$HOME/.vela-release-secrets/sparkle-ed25519.private"
```

本地 feed fixture 使用 `tests/fixtures/sparkle/` 中公开且不安全的测试种子，绝不能用于 Release。

### 暂停和恢复

若最新更新不应继续安装，将 `vela-updates` ref 恢复到不含该条目的有效 feed commit，或发布不含问题版本的新 feed；不要向客户端发布较低 build。已经安装问题版本的设备必须通过更高 Apple build 的修复版本恢复。

feed 发布失败时，compare-and-swap 会保留上一份有效内容。修复 environment、权限或 Release 资产后可重跑 `release.published` workflow；重复发布同一 build 是幂等操作。

## 编写版本说明

每个版本必须先添加独立的版本说明：

```text
releases/X.Y.Z.md
```

该文件只写本版本的产品摘要、更新内容、修复和已知限制，不写一级标题，也不重复“下载”“macOS 安装”“验证下载”等通用区块。发布流水线根据 tag 读取同版本文件，并自动追加标题、资产表格、安装步骤、签名状态、SHA-256、Artifact Attestation 和源代码链接。

版本说明缺失、为空、包含 `TODO`/`TBD`/`FIXME` 或覆盖保留区块时，Release 组装必须失败。这样每个版本的变化由维护者明确撰写，平台和安全信息则保持统一。

## 验证下载

把 ZIP 与 `SHA256SUMS` 下载到同一目录后运行：

```sh
shasum -a 256 -c SHA256SUMS
gh attestation verify Vela-Desktop-X.Y.Z-macos-arm64.zip --repo thonatos/project-v
```

第一条命令验证文件内容与 Release 声明一致；第二条命令验证 GitHub Actions 构建来源。二者都不代表 Apple 已签名或公证该应用。

## 首次安装

当前 Vela 使用 ad-hoc 签名，没有使用付费 Apple Developer Program 提供的 Developer ID，也没有提交 Apple 公证。macOS Gatekeeper 因此会阻止第一次直接打开。

1. 解压 ZIP，把 `Vela.app` 移入“应用程序”。
2. 尝试打开 Vela 一次，让 macOS 记录拦截。
3. 打开“系统设置 → 隐私与安全”。
4. 在 Vela 的安全提示旁选择“仍要打开”。
5. 在确认对话框中再次选择“打开”。

授权后可以正常启动。下载并覆盖安装新版本不会删除 `~/Library/Application Support/Vela/` 中的配置与私人网络身份，但新下载的应用可能再次触发 Gatekeeper 确认。

技术用户在确认 GitHub 来源和 SHA-256 后，可以把下面的命令作为备用方法；不得对不可信应用使用：

```sh
xattr -dr com.apple.quarantine /Applications/Vela.app
open /Applications/Vela.app
```

不要全局关闭 Gatekeeper，也不要执行 `sudo spctl --master-disable`。

## 本地生成发布资产

在满足 `development.md` 中固定工具链要求的 Apple Silicon Mac 上，从 Vela 目录运行 macOS 发布门：

```sh
pnpm run verify:macos-release
```

该入口执行共享与 macOS 验证、组装应用、检查 Bundle/Mach-O/ad-hoc 签名、运行隔离生命周期 smoke、生成 ZIP，并在解压后再次检查应用。发布资产只写入 Vela 的 `.tmp/`。

## 发布边界

- Bundle ID：`io.implements.vela.macos`
- 架构：`arm64`
- 最低系统：macOS 14
- 签名：ad-hoc
- Apple 公证：无
- 应用内更新：Sparkle 2.10.1，完整 ZIP，EdDSA 验证，稳定单通道
- 系统权限：不请求 root，不安装 Network Extension 或 TUN，不修改系统代理、DNS 或路由

发布自动化只创建 Draft Prerelease。维护者必须检查安装说明、资产摘要、构建证明与 smoke 结果后，才能在 GitHub 上手动公开。

发布清单按“组件 + 平台 + 架构”组织。未来 Linux Node（CLI、常驻服务和内嵌 Web UI）将作为独立资产加入同一清单，不改变 macOS Desktop 的字段语义。
