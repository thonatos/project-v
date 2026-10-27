# Design

## Context

参见 `proposal.md` 的动机。当前 macOS 产物由脚本直接组装，`Vela.app` 内含 Rust host、Go `vela-core`、NSH runtime、`bundle.nshc` 与资源，最终以 ad-hoc 签名 ZIP 发布到 GitHub Release。`vela-vX.Y.Z` workflow 只创建 Draft Prerelease，维护者人工公开；`release.json`、`SHA256SUMS` 和 Artifact Attestation 已提供发布来源证据。

Vela 的 AppKit 生命周期由 `macos/host/src/runner.rs` 所有：关闭窗口只隐藏，正式退出在终止回调中有界关闭 Core helper。NSH 0.2.0 提供 `.nshpkg` 验签、防降级和健康接受原语，但明确不提供 OTA 分发，且无法更新 Vela 的 native host 与 Go Core，因此不适合作为本变更的完整更新边界。

当前版本为 `0.2.0` / Apple build `2`。首个带更新器的版本只能继续通过手动安装引导已有用户进入自动更新链。

## Goals / Non-Goals

**Goals:**

- 让一个受验证的 macOS ZIP 原子替换完整 `Vela.app`，并复用 Vela 的正式退出清理语义。
- 保持更新 UI、权限处理、安装事务和 relaunch 符合 macOS 习惯，应用代码只拥有 Vela 特有的触发与生命周期协调。
- 让稳定 feed 只在公开 Release 后推进，并保持版本、build、文件、大小和签名可由已有发布事实校验。
- 将更新私钥限制在无源码执行的专用 feed 发布阶段，失败时保留上一份 feed。

**Non-Goals:**

- 不更新 iOS，不实现 NSH `.nshpkg` UI OTA，也不建立 host/Core/UI 的独立兼容矩阵。
- 不实现强制更新、静默安装、beta 通道、灰度发布或 delta update。
- 不在本变更中引入 Developer ID、公证、sandbox 或 hardened runtime；这些应作为后续独立信任升级。
- 不自行实现应用目录覆盖、提权 helper、安装事务或更新对话框。

## Decisions

### 1. 使用 Sparkle 2 更新完整应用

固定使用 Sparkle `2.10.1` 的官方发行归档及其 SHA-256，并将 framework 和必要 helper 作为嵌套 bundle 组装、由内向外签名。Rust host 通过 `objc2` 声明最小 Objective-C 接口并持有 `SPUStandardUpdaterController`，不引入另一套 UI runtime。

选择理由：Sparkle 已拥有更新检查、原生 UI、EdDSA、权限与可写性判断、事务替换、install-on-quit 和 relaunch；这些是自研更新器最危险且与 Vela 业务无关的部分。NSH signed package 只覆盖 TSX/资源，而且分发与 macOS 高层 embedding 仍需 Vela 自建；“检查 Release 后打开浏览器”只能改善发现，不能完成自动安装。

更新器属于 native host。TSX 菜单只调用一个稳定的语义命令（建议独立的 `vela/update` native module），不得接触 feed、密钥、文件路径或安装状态机。自动检查授权和更新对话框使用 Sparkle 标准界面；首次启动沿用 Sparkle 的低打扰许可时机。

### 2. 正式退出是安装前唯一清理边界

将 Core/helper 的有界 shutdown 提前到 AppKit 的正式终止决策路径，成功清理或到达三秒上限后允许应用退出。普通 `Cmd+Q`、Dock 退出和 Sparkle 发起的安装退出走同一 owner；`windowShouldClose` 仍只隐藏窗口。

```text
User/Sparkle       AppKit delegate       Vela supervisor       Sparkle helper
     |                    |                     |                    |
     | install/restart    |                     |                    |
     |------------------->|                     |                    |
     |                    | stop new work       |                    |
     |                    |-------------------->|                    |
     |                    | bounded shutdown    |                    |
     |                    |<--------------------|                    |
     |                    | stop NSH view       |                    |
     |                    | terminate process   |                    |
     |                    |----------------------------------------->|
     |                    |                     | replace Vela.app   |
     |                    |                     |<-------------------|
     |<--------------------------------------------------------------|
     |                 launch new build                              |
```

同步、有界终止优先于新增异步状态机，因为现有 supervisor 已提供固定上限；若实测 Sparkle delegate 顺序要求延迟终止，再使用 AppKit 的 terminate-later/reply 机制，但对外不改变同一清理契约。

### 3. 延续现有 ZIP，增加独立 EdDSA 更新验证

Sparkle 公钥写入 `Info.plist` 并随应用交付；私钥作为 GitHub environment secret 保存。客户端必须用 Sparkle EdDSA 验证 ZIP，现有 SHA-256 和 GitHub Artifact Attestation 继续服务于人工下载和发布来源审计，不能替代客户端签名。

当前 ad-hoc、未公证状态保持不变并继续披露。更新框架和 helper 必须在解压后的 Release ZIP 中再次验证；构建脚本不得依赖 `codesign --deep` 自动修复嵌套签名，而应明确枚举并由内向外签署。真实更新验收需要证明 ad-hoc 组合在目标 macOS 上可运行，不能仅由源码或 headless 测试推断。

### 4. 以公开 Release 事件推进专用稳定 feed 分支

保留 tag workflow 的 Draft Prerelease 和人工确认。新增只监听 `release.published` 的 workflow，并拒绝 draft、prerelease、错误 tag 或非 Vela 资产。该 job 不 checkout 或执行仓库构建代码，只下载已公开 Release 的标准资产并使用受信任、预置或摘要校验后的发布工具：

1. 校验 tag、`release.json`、ZIP 文件名/大小/SHA-256、bundle id、营销版本、Apple build、最低系统版本和 Artifact Attestation。
2. 使用受保护的 Sparkle EdDSA 私钥为同一 ZIP 生成签名。
3. 从这些事实生成只含最新稳定版本的 `appcast.xml`；不生成 delta。任何更旧客户端都直接更新到最新稳定版本。
4. 通过 GitHub Git Data API 将 feed 写入专用 `vela-updates` 分支的固定路径，并以单次 ref 更新发布新 commit。固定 URL 使用该分支的 raw HTTPS 地址。

专用分支避免修改 `main`、避免与 monorepo 中其他产品的 GitHub “latest release”竞争，也不要求启用或接管 GitHub Pages。受保护 workflow 只获得读取 Release、验证 attestation、读取更新 secret 和更新该 feed ref 所需权限；实现时应通过 environment approval 约束 secret。

```text
Maintainer        GitHub Release       Feed workflow        vela-updates ref       Vela
     |                   |                   |                      |                 |
     | publish stable    |                   |                      |                 |
     |------------------>| published event   |                      |                 |
     |                   |------------------>|                      |                 |
     |                   | download assets   |                      |                 |
     |                   |<----------------->|                      |                 |
     |                   |                   | verify + EdDSA sign  |                 |
     |                   |                   | create feed commit   |                 |
     |                   |                   |--------------------->|                 |
     |                   |                   | atomic ref update    |                 |
     |                   |                   |--------------------->|                 |
     |                   |                   |                      |<---- check -----|
     |                   |                   |                      |----- update ---->|
```

不选择 `releases/latest/download/appcast.xml`，因为 GitHub 的 latest 是整个 monorepo 级别；不选择提交到 `main`，因为发布不应制造源码提交；不选择手工 appcast，因为它会形成第二套版本事实。

### 5. Feed 从标准资产派生，暂不改变 release.json schema

首期不修改当前严格的 `release.json` schema version 1。feed workflow 从已经校验的 `release.json` 取得版本、文件、大小和平台约束，从 ZIP 内 `Info.plist` 取得 Apple build 并交叉校验营销版本，再针对下载到的 ZIP 计算 EdDSA 签名和不可变 Release URL。

这样现有平台无关清单、assembler 和其他潜在组件消费者不需要迁移。若未来多个更新通道或多个可自动更新平台都需要 build/signature 元数据，再单独设计 schema v2；不能在 v1 中加入未声明字段。

### 6. 更新偏好由 Sparkle 持久化，Vela 不复制状态

自动检查许可、上次检查时间和待安装更新由 Sparkle 的既有持久化机制所有。Vela 不在 Go Core 配置中增加更新字段，也不把运行状态复制到共享 store。首期设置页无需新增自定义更新面板；“检查更新…”菜单和 Sparkle 标准授权/UI 已覆盖必要交互。若后续需要显式偏好行，应直接绑定同一 native updater owner，而不是建立第二份状态。

## Risks / Trade-offs

- [ad-hoc、未公证应用的 Sparkle/helper 行为可能受 Gatekeeper 或嵌套签名限制] -> 在首个发布前以两个真实 build 完成 `/Applications` 端到端更新；继续披露信任状态，并把 Developer ID + notarization 作为后续优先项。
- [Sparkle framework 引入 Objective-C ABI 与复杂嵌套 bundle] -> 固定版本和摘要，只声明最小接口，校验 framework/helper 架构、rpath、symlink、执行权限及解压后签名。
- [发布事件可能被重复投递或 workflow 重跑] -> feed 生成保持确定性；以当前 ref SHA 做 compare-and-swap，目标版本不高于当前 feed 时幂等退出，冲突时失败而不覆盖。
- [公开 Release 后 feed job 失败，Release 可手动下载但客户端不可发现] -> 将 feed job 设为可见发布检查并告警；失败不改旧 feed，可在修复权限或 secret 后安全重跑。
- [更新私钥泄漏会允许攻击者签署恶意 ZIP] -> 使用受保护 environment secret、最小权限和审批；不上传私钥或派生产物。密钥轮换受 ad-hoc 分发限制，丢失/泄漏时需要通过仍可信的完整版本迁移公钥。
- [只保留最新 feed 条目会减少历史说明和分阶段路径] -> 首期所有受支持 build 直接更新到最新完整 ZIP；以后需要 delta 或分阶段迁移时再保留历史条目。
- [首个 updater 版本无法自动到达 0.2.0 用户] -> 将首个版本作为一次性手动迁移版本，在 Release 说明中明确后续版本可应用内更新。
- [从 feed 移除问题版本无法卸载已安装版本] -> 立即停止新发现，并发布更高 Apple build 的修复；永不通过 feed 降级。

## Migration Plan

1. 固定并验证 Sparkle 发行依赖，建立两 build 的本地 fixture 和发布门禁。
2. 在 host 中集成 updater、菜单语义命令和统一终止清理；更新应用组装、plist 与签名检查。
3. 将 Vela 营销版本从 `0.2.0` 升至 `0.3.0`，Apple build 从 `2` 升至 `3`，同步所有 macOS/iOS 正式版本来源；iOS 产品行为不变。
4. 配置 EdDSA key：公钥进入应用，私钥进入受保护 GitHub environment；禁止将真实私钥放入本地 fixture。
5. 增加 `release.published` feed workflow，在测试仓库或隔离 feed 路径验证重复事件、失败保留和原子 ref 更新。
6. 使用 updater-capable 的旧 build 与更高 build，在目标 macOS 的 `/Applications` 中验证发现、下载、验签、有活动资源时退出、完整替换、relaunch、版本读取和数据保留。
7. 手动发布 `0.3.0` 作为迁移版本；确认公开 Release 能生成稳定 feed，再启用应用中的生产 feed URL。后续版本按正常自动更新路径发布。

回退时先将 `vela-updates` ref 恢复到上一个有效 feed commit 或发布不含问题版本的 feed，以停止新发现；已经安装问题 build 的用户通过更高 build 修复。若 host 集成需要移除，则由后续完整更新删除 Sparkle，手动 Release 路径始终保留。
