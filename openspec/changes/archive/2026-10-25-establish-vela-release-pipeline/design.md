# Design

## Context

参见 `proposal.md` 的动机。当前根级 Node.js CI 在 Ubuntu 上明确跳过 Vela；Vela 的 `verify` 和 `verify:release` 只在本地使用，后者还同时组装 macOS 与 iOS，不适合作为 macOS GitHub Release 的直接入口。`build-app.sh` 生成 arm64 `.app` 并执行 ad-hoc 签名，没有 ZIP、校验和、发布清单或来源证明。

Vela 声明支持 macOS 14，但现有构建产物中 Rust 主程序的 `minos` 为 11.0，Go 辅助程序的 `minos` 为 27.0；辅助程序使实际产物无法满足声明。仓库公开且 GitHub 标准 macOS arm64 runner 可用，因此发布产物应在干净的 GitHub 托管环境中构建。

未来 Linux 首要产品形态是无桌面依赖的 Vela Node：单一 `vela` 二进制提供 CLI、常驻发布服务和内嵌 Web UI。Web UI 可监听 localhost 或显式 `0.0.0.0`，只提供 HTTP，TLS 与证书由 Caddy/Nginx 管理。该实现不属于本次变更，但发布契约不得绑定 Apple bundle 或桌面 GUI。

## Goals / Non-Goals

**Goals:**

- 在 Vela 相关变更上提供独立、可取消旧运行的 CI，并在 macOS arm64 runner 上执行现有完整验证和应用 smoke test。
- 从受信任的 `vela-vX.Y.Z` tag 在干净环境中生成 macOS Desktop Release。
- 固定并验证 NSH、Rust、Go、Node.js、pnpm 和 Xcode 环境。
- 在上传前验证版本、bundle、Mach-O、签名和 ZIP 解压结果。
- 用统一 manifest、SHA-256 与 GitHub Artifact Attestation 建立可追溯来源。
- 把编译、证明和发布权限分开；最终发布阶段不 checkout 或执行仓库代码。
- 让发布元数据能够直接增加未来 Linux Node 的 x86_64/arm64 归档。

**Non-Goals:**

- 不申请或配置 Apple Developer ID，不做 notarization、stapling、App Store 或自动更新。
- 不实现 Linux Node、CLI、Web UI、systemd unit、Linux Desktop 或 Linux 产物。
- 不提供 TLS、ACME、证书管理或 Caddy/Nginx 自动配置。
- 不发布 iOS 资产，也不改变 iOS 免费签名和安装流程。
- 不在本次重构现有 Core 为 daemon、Unix socket 或 HTTP transport。
- 不承诺 Intel Mac 或 universal binary。

## Decisions

### 1. 发布编排按组件和平台组织

顶层发布流程使用 `prepare -> platform builders -> assemble -> attest -> publish`，当前只有 `build-macos-desktop`。未来 Linux 不作为 macOS job 的 matrix 变体，而增加独立 `build-linux-node`，因为两者的工具链、验证和包装方式不同。

```text
vela-vX.Y.Z
      |
      v
+-------------+
| prepare     |
| version gate|
+------+------+
       |
       v
+---------------------+       +---------------------+
| build-macos-desktop |       | build-linux-node    |
| enabled now         |       | future              |
+----------+----------+       +----------+----------+
           |                             |
           +-------------+---------------+
                         v
                 +-------+-------+
                 | assemble      |
                 | hash/manifest |
                 +-------+-------+
                         v
                 +-------+-------+
                 | attest       |
                 +-------+-------+
                         v
                 +-------+-------+
                 | draft release |
                 +---------------+
```

替代方案是一个 OS matrix。它写法短，但会把 `.app`、ELF、ad-hoc 签名、XDG/systemd 等平台契约混进条件分支，Linux 加入后难以维护，因此不采用。

### 2. CI 与 Release 分为两个 workflow

- `vela-ci.yml` 由 Vela 相关路径的 pull request 和 `main` push 触发，使用只读权限；同一 ref 的旧运行自动取消。
- `vela-release.yml` 仅由 `vela-v*` tag 触发。失败任务可从 GitHub Actions 重跑，不另设绕过 tag 门禁的手动发布入口。
- Vela 相关路径包括应用源码、根工作区和 lockfile、Vela workflow 自身；文档-only 改动是否触发完整 macOS job由 path filter 明确记录。

替代方案是扩充现有根 CI。现有 job 在 Ubuntu 上运行并跳过 Vela，加入 macOS/iOS 工具链会增加无关应用的反馈时间，因此使用独立 workflow。

### 3. 验证编排拆成共享门与平台门

保留现有测试和检查实现，但增加薄编排入口：共享门包含结构、协议、共享 UI 投影、Go Core 与不依赖 Apple SDK 的 Rust 检查；macOS 门包含 macOS NSH/UI、AppKit 宿主、网络隔离、应用组装、产物契约和生命周期 smoke。现有聚合 `verify` 可以顺序调用这些入口并追加 iOS 门，保持本地开发命令兼容。

发布只依赖共享门和 macOS 门，不调用同时构建 iOS 的 `verify:release`。未来 Linux Node 复用共享门并增加独立 Linux Node 门，无需从 macOS job 中拆测试。

### 4. 工具链使用项目声明加独立完整性校验

- Node.js 24，pnpm 12.14.0，Rust 1.98.1，Go 1.27.2，NSH 0.2.0。
- macOS 使用明确的 arm64 runner/Xcode 27 标签，不使用 `macos-latest`。
- NSH CLI 从 `v0.2.0` 的 macOS arm64 发行资产下载，必须匹配 SHA-256 `a189be8537422a147131c88d7fd39d73265a6aebfbb530287c36a393ff3953fc`。
- `NSH_SOURCE` checkout 到 `v0.2.0` 的 peeled commit `669b62b11449b2ab787b7c82649a392cbff25b8f`，而不是只信任 tag 对象或分支名。
- NSH 归档可按版本、架构和摘要缓存，但每次恢复缓存后仍重新校验摘要和版本。
- 新 workflow 使用的 GitHub Actions 固定到完整 commit SHA，避免浮动 action tag 成为发布供应链入口。

替代方案是执行 `curl https://nsh.dev/install.sh | sh`。它不能证明实际执行内容与项目声明版本一致，因此不用于发布构建。

### 5. deployment target 是构建输入和产物门禁

macOS 组装在 Rust、Go/cgo、NSH 与资源编译阶段统一设置 `MACOSX_DEPLOYMENT_TARGET=14.0`。构建后枚举 `.app` 中所有 Mach-O，读取 `LC_BUILD_VERSION`/`LC_VERSION_MIN_MACOSX`：任一文件架构不是 arm64或 `minos > 14.0` 即失败，并输出文件名和实际值。

校验允许 `minos < 14.0`，因为 Bundle 的 `LSMinimumSystemVersion=14.0` 仍负责最终启动下限；真正必须阻止的是内嵌可执行文件要求更高系统版本。主程序、辅助程序和 Bundle 版本/标识也必须校验。

替代方案是只读 `Info.plist`。当前 `vela-core minos 27.0` 已证明清单声明不足以代表真实兼容性，因此不采用。

### 6. ad-hoc 签名保留，但不模拟 Apple 信任

继续采用 inside-out ad-hoc 签名：先签 `Contents/Helpers/vela-core`，再签外层 `.app`，之后执行 `codesign --verify --deep --strict`。发布检查还要确认签名是 ad-hoc 且没有 TeamIdentifier，防止 manifest 与实际状态不一致。

不把 `spctl` 通过作为门禁，因为没有 Developer ID 的下载产物预期会被 Gatekeeper 拒绝。Release 说明必须给出 Apple 官方“仍要打开”流程；`xattr -dr com.apple.quarantine` 仅可作为明确标注风险的技术用户备用方式，不能包装成自动安装器。

### 7. 生命周期 smoke 使用隔离用户目录

运行打包后的主程序时，将 HOME/TMPDIR 指向仓库内 Vela `.tmp`，设置现有 `VELA_LIFECYCLE_SCRIPT=close,reopen,quit`，验证 Core 拉起、窗口关闭、恢复和优雅退出。smoke 不能读取开发者真实 Tailscale 身份，也不要求网络登录。

CI 还要设置有界超时，并在失败时上传脱敏日志；不得通过截图作为 Vela UI 验收。

### 8. Release 资产与 manifest 使用稳定契约

首个资产集合：

```text
Vela-Desktop-X.Y.Z-macos-arm64.zip
SHA256SUMS
release.json
release-notes.md
```

ZIP 使用 `ditto -c -k --sequesterRsrc --keepParent` 创建。随后解压到新目录，再次执行 bundle、Mach-O 与 codesign 检查。`SHA256SUMS` 至少覆盖所有可执行发行归档。

`release.json` schema version 1 使用数组：

```json
{
  "schemaVersion": 1,
  "product": "vela",
  "version": "0.1.0",
  "tag": "vela-v0.1.0",
  "commit": "<sha>",
  "protocolVersion": 1,
  "artifacts": [
    {
      "component": "desktop",
      "platform": "macos",
      "architecture": "arm64",
      "format": "zip",
      "capabilities": ["publish", "access", "manage"],
      "file": "Vela-Desktop-0.1.0-macos-arm64.zip",
      "size": 123,
      "sha256": "<sha256>",
      "minimumSystemVersion": "14.0",
      "signing": "adhoc",
      "notarized": false
    }
  ]
}
```

不加入生成时间，避免没有行为价值的非确定内容。未来 Linux Node 追加 `component=node`、`platform=linux`、对应架构/格式以及 `publish`、`manage-cli`、`manage-web` 能力；macOS 字段不变。Linux Web UI 的监听和反向代理安全规则属于未来运行时 spec，不放入 Release schema。

### 9. 构建来源证明附着于每个运行资产

平台 builder 上传不可变中间 artifact；只读 assemble job 生成最终 `SHA256SUMS`、`release.json` 和说明。attest job 下载最终运行资产，以 GitHub OIDC 和 Artifact Attestation 为每个 ZIP/tarball 建立 Sigstore provenance。用户通过：

```sh
shasum -a 256 -c SHA256SUMS
gh attestation verify Vela-Desktop-X.Y.Z-macos-arm64.zip --repo thonatos/project-v
```

分别验证下载完整性和 GitHub Actions 来源。Attestation 不声称 Apple 已信任该程序，也不替代未来 Linux 包仓库的 GPG metadata 签名。

### 10. 发布权限与代码执行隔离

```text
build/assemble: contents: read
attest:        contents: read, id-token: write, attestations: write
publish:       contents: write
```

publish job 不 checkout，不执行仓库脚本，只下载已经组装和证明的资产并使用 GitHub CLI 创建或更新 Draft Prerelease。这样携带 `contents: write` 的阶段不运行项目构建代码。PR/fork workflow 永远没有 OIDC、证明或发布权限。

Release 创建应可安全重跑：同 tag 已有 draft 时更新说明并以 `--clobber` 替换同名资产；不得覆盖已公开 Release。

### 11. Release 说明由流水线生成并显式陈述限制

说明包含：macOS 14+、Apple Silicon、未 Developer ID 签名、未公证、拖入 Applications、首次尝试打开后前往“系统设置 -> 隐私与安全 -> 仍要打开”、SHA-256/Attestation 校验命令及源代码链接。自动化只创建 Draft Prerelease，维护者检查资产、说明和 smoke 结果后手动公开。

## Release Sequence

```text
Maintainer      GitHub       Build job       Attest job      Publish job
    |              |             |                |                |
    | push tag     |             |                |                |
    |------------->|             |                |                |
    |              | validate version             |                |
    |              |------------>|                |                |
    |              |             | verify/build   |                |
    |              |             | package/recheck|                |
    |              |             | upload assets  |                |
    |              |             |--------------->|                |
    |              |             |                | attest ZIP     |
    |              |             |                |--------------->|
    |              |             |                |                | create draft
    |              |<------------------------------------------------|
    | review draft |             |                |                |
    |<-------------|             |                |                |
    | publish      |             |                |                |
    |------------->|             |                |                |
```

## Risks / Trade-offs

- [Gatekeeper 仍会拦截] -> 明确使用 Draft/Prerelease、官方“仍要打开”步骤、SHA-256 和 Attestation；不声称这些机制替代 Developer ID。
- [GitHub runner/Xcode 镜像漂移] -> 使用明确 runner 标签，记录所有工具版本，并以最终 Mach-O 检查作为真实兼容性门禁。
- [NSH 发行包较大且下载慢] -> 使用按摘要命名的缓存，但缓存命中后仍做完整性校验。
- [GUI smoke 在托管 runner 上不稳定] -> 使用已有确定性生命周期脚本、有界超时和日志，避免像素或截图断言。
- [ad-hoc 签名导致不可复现字节] -> 构建来源以 tag、commit、公开日志、哈希和 Attestation 为准；本次不承诺 bit-for-bit reproducible build。
- [未来 Linux schema 需求变化] -> `schemaVersion` 明确版本化；新增可选平台字段时保持 version 1 已有字段语义，破坏性调整才升级 schema。
- [验证入口拆分造成已有聚合命令漂移] -> 只提取编排，不移动测试实现；让现有 `verify` 组合新入口，并增加测试保证每项检查仍被某个门覆盖。
- [发布 job 可写仓库内容] -> 不 checkout、不执行项目代码，只消费已证明资产；工作流级默认权限保持 read。

## Migration Plan

1. 增加版本、工具链、Mach-O 和 release manifest 校验，但先只在本地与 CI artifact 上运行。
2. 修复 `vela-core` 的 deployment target，使 macOS 产物满足声明的 macOS 14 基线。
3. 启用 Vela CI，在 pull request 和 main 上稳定运行后，将其作为 Vela 变更的必需检查。
4. 增加 tag Release workflow，先用测试 tag 生成 Draft Prerelease，验证 ZIP 解压、安装说明、哈希和 Attestation。
5. 删除测试 draft/tag；创建首个正式 `vela-vX.Y.Z` tag，人工检查草稿后发布。
6. 若需回滚，禁用新增 workflow 并删除尚未公开的 draft/tag；本地 `build:app`、iOS 构建和运行时数据格式不受影响。

## Open Questions

- 首个公开版本使用当前 `0.1.0`，还是在实施后提升为新的 patch 版本；该选择只影响实际 tag，不改变流程设计。
- Vela 文档改动是否需要完整 macOS CI，还是只执行文档校验；可根据首轮 CI 时长调整 path filter，不改变发布契约。
