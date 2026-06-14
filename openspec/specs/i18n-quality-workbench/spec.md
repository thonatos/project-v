# i18n-quality-workbench Specification

## Purpose
TBD - created by archiving change modernize-i18n-studio-platform. Update Purpose after archive.
## Requirements
### Requirement: 翻译质量检查

系统 SHALL 为每个 namespace 提供质量检查能力，至少覆盖 missing translation、pending draft、source stale、placeholder mismatch、HTML tag mismatch、ICU/plural 基础错误和长度风险。检查结果 SHALL 可被 UI 和 API 查询。

#### Scenario: 检出缺失翻译

- **GIVEN** 命名空间启用 `zh-cn` 与 `en-us`，词条 `home.title` 只有 `zh-cn` published
- **WHEN** 运行质量扫描
- **THEN** 系统为 `home.title/en-us` 产生 `missing_translation` 问题

#### Scenario: 检出占位符不匹配

- **GIVEN** source 文案为 `Hello {name}`，目标文案为 `Hello`
- **WHEN** 运行质量扫描
- **THEN** 系统产生 `placeholder_mismatch` 问题，并记录缺失的 `{name}`

#### Scenario: 检出过期目标文案

- **GIVEN** source locale 在目标 locale 发布后又产生新的 published version
- **WHEN** 运行质量扫描
- **THEN** 系统为目标 locale 产生 `source_stale` 问题，并记录 source version 与 target version

### Requirement: 质量工作台审阅队列

系统 SHALL 提供 namespace 级质量工作台，允许用户按问题类型、locale、prefix、严重程度和状态筛选问题，并进入对应词条进行修复或审阅。

#### Scenario: 按问题类型筛选

- **GIVEN** 命名空间存在 missing 与 placeholder 两类质量问题
- **WHEN** 用户在质量工作台选择 `placeholder_mismatch`
- **THEN** 页面仅展示该类型问题，并保留 locale、key、source、target 和修复入口

#### Scenario: 从问题进入词条编辑

- **GIVEN** 用户在质量工作台看到 `home.title/en-us` 的问题
- **WHEN** 用户点击该问题
- **THEN** 系统导航到对应词条编辑页，并聚焦或标记对应 locale 的编辑区域

#### Scenario: viewer 只读质量问题

- **GIVEN** 用户角色为 `viewer`
- **WHEN** 用户打开质量工作台
- **THEN** 用户可查看问题，但不能执行修复、resolve 或 suppress 操作

### Requirement: 问题状态管理

系统 SHALL 支持将质量问题标记为 resolved 或 suppressed。suppressed 问题 MUST 记录 actor、原因和规则版本，并在默认队列中隐藏。

#### Scenario: 修复后自动 resolved

- **GIVEN** `home.title/en-us` 存在 `missing_translation` 问题
- **WHEN** 用户补齐并发布 `en-us` 翻译后重新扫描
- **THEN** 系统将该问题标记为 resolved

#### Scenario: 用户 suppress 问题

- **GIVEN** editor 认为某条长度风险是可接受的
- **WHEN** editor 提交 suppress 原因
- **THEN** 系统将问题标记为 suppressed，并写入 audit event

