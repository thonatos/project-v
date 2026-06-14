# i18n-release-governance Specification

## Purpose
TBD - created by archiving change modernize-i18n-studio-platform. Update Purpose after archive.
## Requirements
### Requirement: Release manifest 发布模型

系统 SHALL 在每次使客户端可见文案发生变化的发布操作中创建 release manifest。manifest MUST 记录该 namespace 在目标 `bundle_version` 下每个已发布 `(entry, locale)` 指向的 translation version，使固定版本 snapshot 可复现。

#### Scenario: 发布创建 release manifest

- **GIVEN** 命名空间 `docs` 有若干已发布词条且存在 draft
- **WHEN** 用户发布 draft 并导致 `bundle_version` 递增
- **THEN** 系统创建一条 release 记录，并为该 release 写入完整的 published `(entry, locale)` manifest

#### Scenario: 批量发布共享一个 release

- **GIVEN** 用户一次批量发布多个 draft
- **WHEN** 发布事务提交成功
- **THEN** 系统仅递增一次 `bundle_version`，并仅创建一个包含批量发布后完整状态的 release

#### Scenario: 无文案可见变化不创建 release

- **GIVEN** 用户保存 draft、discard draft 或更新仅后台可见的描述
- **WHEN** 操作完成
- **THEN** 系统 MUST NOT 创建新的 release manifest，且 `bundle_version` 不递增

### Requirement: Immutable fixed snapshot

系统 SHALL 使用 release manifest 响应带 `bundle_version` 的 snapshot 请求。固定版本 snapshot 的响应 MUST immutable，且 MUST NOT 随后续发布变化。

#### Scenario: 固定版本 snapshot 可复现

- **GIVEN** `bundle_version=3` 的 release manifest 已存在，随后命名空间又发布到 `bundle_version=4`
- **WHEN** 客户端请求 `GET /snapshot/docs?bundle_version=3`
- **THEN** 响应内容与 version 3 release manifest 完全一致，不包含 version 4 才发布的变更

#### Scenario: 固定单语言 snapshot 可复现

- **GIVEN** `bundle_version=3` 的 release manifest 包含 `zh-cn` 与 `en-us`
- **WHEN** 客户端请求 `GET /snapshot/docs/en-us?bundle_version=3`
- **THEN** 响应只包含 manifest 中 `en-us` 的 key/value，并返回 immutable cache header

#### Scenario: 不存在的 release 返回错误

- **GIVEN** 命名空间 `docs` 不存在 `bundle_version=999` 的 release
- **WHEN** 客户端请求 `GET /snapshot/docs?bundle_version=999`
- **THEN** 系统返回 404 或 422 JSON 错误，MUST NOT 使用 per-entry translation version 推算结果

### Requirement: Release 审计与回滚

系统 SHALL 为 release 创建、回滚和删除 namespace 等影响发布状态的操作写入 audit event。回滚 release MUST 通过创建新 release 完成，而不是修改历史 release manifest。

#### Scenario: 发布写入审计事件

- **GIVEN** 用户发布 draft
- **WHEN** release manifest 创建成功
- **THEN** 系统写入 audit event，记录 actor、namespace、release id、bundle_version、发布 item 数量和来源

#### Scenario: 回滚创建新 release

- **GIVEN** 当前 latest 为 `bundle_version=5`，用户选择回滚到 `bundle_version=3`
- **WHEN** 回滚操作提交
- **THEN** 系统创建新的 `bundle_version=6` release，其 manifest 与 version 3 等价，并写入回滚审计事件

#### Scenario: 历史 release 不可变

- **GIVEN** release `bundle_version=3` 已创建
- **WHEN** 后续发生发布、回滚或 namespace 设置变化
- **THEN** 系统 MUST NOT 修改 version 3 的 manifest 内容

