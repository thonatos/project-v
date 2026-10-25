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
- 系统权限：不请求 root，不安装 Network Extension 或 TUN，不修改系统代理、DNS 或路由

发布自动化只创建 Draft Prerelease。维护者必须检查安装说明、资产摘要、构建证明与 smoke 结果后，才能在 GitHub 上手动公开。

发布清单按“组件 + 平台 + 架构”组织。未来 Linux Node（CLI、常驻服务和内嵌 Web UI）将作为独立资产加入同一清单，不改变 macOS Desktop 的字段语义。
