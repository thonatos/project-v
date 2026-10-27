# vela-release-distribution Specification

## Purpose

为 Vela 提供可重复验证、来源可追溯且按组件和平台扩展的持续集成与 GitHub Release 契约，使未使用 Apple Developer ID 的 macOS 产物仍能被用户审慎验证，并允许未来加入 Linux Node 产物而不破坏发布格式。

## Requirements

### Requirement: Vela 变更必须经过平台分层验证
系统 MUST 将 Vela 的共享验证与平台验证分开执行；影响 Vela 的拉取请求和主分支提交必须通过共享验证及当前已支持发布平台的验证，任一必需验证失败时不得生成可发布资产。

#### Scenario: macOS 相关变更通过验证
- **GIVEN** 一个提交修改了 Vela 源码、依赖锁或发布配置
- **WHEN** 持续集成执行该提交
- **THEN** 系统必须执行共享协议与 Core 验证以及 macOS arm64 的界面、宿主、应用组装和生命周期验证

#### Scenario: 平台验证失败
- **GIVEN** Vela 的共享验证已经通过
- **WHEN** macOS 应用组装、启动或平台契约检查失败
- **THEN** 系统必须将提交标记为失败且不得产生可发布资产

### Requirement: 发布工具链必须固定且可验证
发布构建 MUST 使用明确版本的 Node.js、pnpm、Rust、Go、NSH、Xcode 和目标架构；通过网络取得的 NSH 二进制必须校验摘要，NSH 源码必须解析到与声明版本对应的固定提交。

#### Scenario: 固定工具链构建
- **GIVEN** Vela 发布构建在全新的 GitHub 托管运行器上启动
- **WHEN** 系统准备工具链
- **THEN** 每个工具版本必须与项目声明一致，NSH 下载摘要和源码提交必须通过校验后才可继续

#### Scenario: 工具链内容漂移
- **GIVEN** 下载的 NSH 归档摘要或源码提交与项目声明不一致
- **WHEN** 发布构建校验工具链
- **THEN** 构建必须失败且不得执行未验证的工具或生成发布资产

### Requirement: macOS 发布资产必须满足运行契约
macOS 桌面产物 MUST 是 ad-hoc 签名的 Apple Silicon 应用，bundle 标识、版本、架构和所有 Mach-O 最低系统版本必须与发布声明一致；打包后解压的应用必须再次通过完整性检查。

#### Scenario: 合法的 macOS arm64 产物
- **GIVEN** tag、应用版本和目标最低系统版本一致
- **WHEN** 系统构建并打包 macOS 应用
- **THEN** 主程序与辅助程序必须都是 arm64、最低系统版本不高于声明值、bundle 标识正确且 ad-hoc 签名验证通过

#### Scenario: 辅助程序要求更高系统版本
- **GIVEN** 应用声明支持 macOS 14
- **WHEN** 任一内嵌 Mach-O 声明的最低系统版本高于 macOS 14
- **THEN** 发布门必须失败并指出不兼容文件及其实际最低版本

#### Scenario: ZIP 破坏应用完整性
- **GIVEN** macOS 应用已通过构建目录中的签名与结构检查
- **WHEN** 系统从发布 ZIP 解压应用并重新验证
- **THEN** 解压后的应用必须通过相同检查，否则不得发布该 ZIP

### Requirement: 标签与应用版本必须一致
Vela Release MUST 由 `vela-vX.Y.Z` 格式的标签触发，标签版本必须与所有公开应用版本来源一致；版本不一致时发布必须停止。

#### Scenario: 一致版本创建发布
- **GIVEN** 标签为 `vela-v0.1.0` 且所有 Vela 版本来源均为 `0.1.0`
- **WHEN** 发布流程执行版本门禁
- **THEN** 系统必须允许后续平台构建并在发布元数据中记录版本 `0.1.0`

#### Scenario: 版本来源发生漂移
- **GIVEN** 标签版本与 package、共享常量、平台清单或 bundle 元数据中的任一版本不一致
- **WHEN** 发布流程执行版本门禁
- **THEN** 系统必须失败并列出不一致的版本来源

### Requirement: Release 必须发布可验证的标准资产
每个 Release MUST 包含按产品组件、版本、平台和架构命名的运行资产、`SHA256SUMS` 与 schema version 1 的 `release.json`；每个运行资产必须具备 GitHub Artifact Attestation。

#### Scenario: 首次 macOS Release
- **GIVEN** Vela `0.1.0` 的 macOS arm64 构建通过全部门禁
- **WHEN** 系统组装 Release
- **THEN** Release 必须包含 `Vela-Desktop-0.1.0-macos-arm64.zip`、覆盖该文件的 `SHA256SUMS`、描述该产物的 `release.json` 和可由 GitHub CLI 验证的构建证明

#### Scenario: 校验下载来源
- **GIVEN** 用户下载了 Vela 运行资产和 `SHA256SUMS`
- **WHEN** 用户执行 SHA-256 校验与 GitHub Artifact Attestation 校验
- **THEN** 两种校验必须分别证明文件内容与 Release 一致且文件由本仓库的 GitHub Actions 构建

### Requirement: 发布清单必须支持多组件多平台
`release.json` MUST 使用产物数组，并为每项记录组件、平台、架构、格式、能力、文件名、摘要和平台信任属性；新增平台产物不得要求改变既有字段语义。

#### Scenario: 清单描述 macOS Desktop
- **GIVEN** 当前 Release 仅包含 macOS Desktop
- **WHEN** 系统生成 `release.json`
- **THEN** 清单必须将其记录为 `desktop` 组件、`macos` 平台、`arm64` 架构，并明确 `signing=adhoc` 与 `notarized=false`

#### Scenario: 未来加入 Linux Node
- **GIVEN** 后续版本产生 Linux Node 的 x86_64 或 arm64 归档
- **WHEN** 该资产加入同一版本的 Release
- **THEN** 系统必须能通过新增产物条目记录 `node` 组件及 `publish`、`manage-cli`、`manage-web` 能力，而不改变 macOS 条目的结构或语义

### Requirement: GitHub Release 必须经过人工发布确认
自动化 MUST 只创建 Draft 和 Prerelease，不得直接公开发布；发布说明必须按平台说明系统要求、信任状态、安装方法和资产验证方式。

#### Scenario: tag 构建成功
- **GIVEN** `vela-vX.Y.Z` 标签的全部构建和证明均已完成
- **WHEN** 发布 job 上传资产
- **THEN** 系统必须创建 Draft Prerelease，并等待维护者人工检查后再公开

#### Scenario: 无 Developer ID 的 macOS 安装说明
- **GIVEN** macOS 资产使用 ad-hoc 签名且未公证
- **WHEN** 用户阅读 Release 说明
- **THEN** 说明必须明确该状态并提供“系统设置 → 隐私与安全 → 仍要打开”的官方首次启动步骤，不得声称产物已获 Apple 信任

### Requirement: 发布权限必须最小化
普通验证和平台构建 MUST 只具有仓库内容读取权限；构建证明与 Release 发布权限必须隔离到专用阶段，发布阶段不得重新执行仓库中的构建代码。

#### Scenario: 拉取请求来自分支或 fork
- **GIVEN** 持续集成由拉取请求触发
- **WHEN** Vela 验证运行
- **THEN** 验证不得获得发布权限、身份令牌或发布 secrets

#### Scenario: 创建构建证明和 Release
- **GIVEN** 受信任标签的只读构建产物已经完成
- **WHEN** 证明与发布阶段运行
- **THEN** 系统必须分别只授予生成证明和创建 Release 所需的最小权限，并且发布阶段只能消费已完成的标准资产

### Requirement: 自动更新工具链必须固定且可验证
自动更新构建 MUST 使用明确版本的更新框架和 feed 生成工具；通过网络取得的更新框架归档 MUST 固定来源并校验摘要。框架、辅助程序和应用完成组装后 MUST 按嵌套边界验证结构、架构和签名。

#### Scenario: 固定更新框架构建应用
- **GIVEN** Vela 发布构建在全新的受信任 macOS 运行器上启动
- **WHEN** 系统取得并嵌入更新框架
- **THEN** 框架版本、下载来源和摘要必须与项目声明一致，且嵌套组件和最终应用必须通过发布门禁

#### Scenario: 更新框架内容漂移
- **GIVEN** 下载的更新框架归档与项目声明的摘要不一致
- **WHEN** 发布构建校验依赖
- **THEN** 构建必须失败且不得执行该工具、签署更新资产或生成 Release

### Requirement: macOS 更新资产必须具备客户端可验证签名
每个可进入自动更新通道的 macOS ZIP MUST 使用独立更新密钥签名，并在 feed 中记录归档大小、更新签名、应用版本、Apple build、最低系统版本和不可变下载地址。更新私钥 MUST NOT 存在于仓库、普通验证 job 或可下载构建产物中。

#### Scenario: 发布可安装更新资产
- **GIVEN** macOS ZIP 已通过现有应用完整性和来源门禁
- **WHEN** 受信任发布阶段为其生成更新元数据
- **THEN** feed 条目必须包含与该 ZIP 匹配的客户端更新签名、字节大小、版本、build、最低系统版本和公开下载地址

#### Scenario: 非发布 job 运行
- **GIVEN** 拉取请求、分支验证或只读平台构建正在运行
- **WHEN** workflow 执行 Vela 验证
- **THEN** 这些 job 不得获得更新私钥，也不得产生可进入稳定 feed 的签名条目

#### Scenario: 版本或签名不一致
- **GIVEN** feed 的 build、归档大小、下载文件或更新签名与 ZIP 内应用不一致
- **WHEN** 发布门禁验证更新条目
- **THEN** 发布必须失败并指出不一致字段，不得更新稳定 feed

### Requirement: 稳定更新 feed 必须在人工公开发布后推进
稳定更新 feed MUST 只引用已公开、非 Prerelease 且通过全部发布门禁的 Vela Release。标签构建创建或更新 Draft Prerelease 时 MUST NOT 改变稳定 feed；人工公开 Release 后，独立发布阶段才可原子推进 feed。

#### Scenario: 候选版本仍为 Draft Prerelease
- **GIVEN** `vela-vX.Y.Z` 的构建、证明和签名资产已经完成，但 Release 尚未由维护者公开
- **WHEN** 发布 workflow 创建或更新 Draft Prerelease
- **THEN** 稳定 feed 必须保持不变，已安装客户端不得发现该候选版本

#### Scenario: 维护者公开稳定版本
- **GIVEN** Release 已由维护者公开且不再是 Prerelease
- **WHEN** feed 发布阶段验证 Release 身份、资产和签名
- **THEN** 系统必须原子更新稳定 feed，使客户端能够发现该版本

#### Scenario: 发布后验证失败
- **GIVEN** 公开 Release 缺少标准资产、更新签名或有效版本元数据
- **WHEN** feed 发布阶段执行验证
- **THEN** 稳定 feed 必须保留上一个有效内容并将该阶段标记为失败

### Requirement: 自动更新元数据必须派生自标准发布事实
自动更新 feed MUST 从经校验的标准 Release 资产和应用 bundle 元数据生成，不得由维护者手工重复录入版本、build、大小或下载文件名。平台无关的 `release.json` MUST 保持标准发布清单，并可增加表达自动更新所需发布事实的向后兼容 schema 演进。

#### Scenario: 生成稳定 feed 条目
- **GIVEN** 公开 Release 包含合法 ZIP、标准清单和版本说明
- **WHEN** 系统生成自动更新条目
- **THEN** 版本、资产名、大小和平台约束必须从已验证来源派生，更新签名必须对应同一归档

#### Scenario: 人工编辑造成重复事实
- **GIVEN** 待发布 feed 输入要求维护者再次填写已经存在于标准资产中的版本或文件信息
- **WHEN** 发布门禁检查生成方式
- **THEN** 系统必须拒绝将该手工副本作为权威发布来源

### Requirement: 稳定 feed 回退不得向客户端发布降级
运营方 MUST 能在不修改客户端的情况下停止发布有问题的更新条目，但 MUST NOT 通过向稳定 feed 写入较低 build 来要求客户端降级。已公开版本发生缺陷时，恢复路径 MUST 是暂停发现或发布更高 build 的修复版本。

#### Scenario: 暂停有问题的最新更新
- **GIVEN** 最新 feed 条目被确认不应继续安装
- **WHEN** 维护者回退稳定 feed 发布
- **THEN** 尚未发现该版本的客户端不得再收到它，当前已安装应用不得被指示降级

#### Scenario: 发布修复版本
- **GIVEN** 部分客户端已经安装有缺陷的 build
- **WHEN** 修复版本准备发布
- **THEN** 修复版本必须使用更高 Apple build，并经过与普通稳定更新相同的签名、公开和 feed 门禁
