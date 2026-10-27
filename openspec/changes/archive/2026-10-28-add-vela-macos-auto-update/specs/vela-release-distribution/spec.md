# Spec Delta

## ADDED Requirements

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
