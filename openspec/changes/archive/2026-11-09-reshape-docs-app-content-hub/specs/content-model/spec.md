# Spec Delta

## MODIFIED Requirements

### Requirement: Docs 分类字段

系统 SHALL 支持 `docs` 内容通过 `category` 声明文档分类，并支持 `blog` 内容通过 `category` 声明“技术与工程”或“股票与市场”栏目。

#### Scenario: docs 声明分类

- **GIVEN** 一篇 `type: docs` 内容声明 `category: System & Server`
- **WHEN** 系统读取该内容
- **THEN** 该内容 SHALL 被归入 "System & Server" 文档分类

#### Scenario: docs 缺省分类容错

- **GIVEN** 一篇 `type: docs` 内容未声明 `category`
- **WHEN** 系统读取该内容
- **THEN** 系统 SHALL 将其归入 "Uncategorized" 且不得丢弃该内容

#### Scenario: Blog 声明技术栏目

- **GIVEN** 一篇 `type: blog` 内容声明技术与工程栏目值
- **WHEN** 系统读取该内容
- **THEN** 该内容 SHALL 在 Blog 中显示为“技术与工程”

#### Scenario: Blog 声明市场栏目

- **GIVEN** 一篇 `type: blog` 内容声明股票与市场栏目值
- **WHEN** 系统读取该内容
- **THEN** 该内容 SHALL 在 Blog 中显示为“股票与市场”

#### Scenario: Blog 栏目缺失或无效

- **GIVEN** 一篇 `type: blog` 内容未声明有效栏目
- **WHEN** 系统读取该内容
- **THEN** 构建 SHALL 报告可定位到该内容的错误，不得静默归入任意栏目

#### Scenario: blog 忽略分类

- **GIVEN** 一篇 `type: blog` 内容携带 Docs 自由文本分类值
- **WHEN** 系统读取该内容
- **THEN** 系统 SHALL 不将该值纳入 Docs 分类树
- **THEN** 构建 SHALL 报告该内容未声明有效 Blog 栏目

### Requirement: 按类型与分类派生数据

系统 SHALL 提供按类型过滤、按 Docs 分类分组和按 Blog 栏目筛选的数据，使列表和首页使用同一内容归属与规范 URL。

#### Scenario: 按类型获取文档

- **GIVEN** 站点同时存在 Docs 和 Blog 内容
- **WHEN** 请求其中一种类型
- **THEN** 系统 SHALL 只返回该类型内容并按日期倒序排列

#### Scenario: 按分类分组

- **GIVEN** 存在多个 Docs 分类
- **WHEN** 请求 Docs 分类数据
- **THEN** 系统 SHALL 返回每个分类及其文档列表

#### Scenario: 按 Blog 栏目筛选

- **GIVEN** 存在两个 Blog 栏目
- **WHEN** 请求其中一个栏目
- **THEN** 系统 SHALL 只返回该栏目内容并按日期倒序排列

#### Scenario: 派生规范内容地址

- **GIVEN** 系统读取一篇内容
- **WHEN** 页面需要生成该内容的站内链接
- **THEN** Docs 内容 SHALL 使用 `/docs/:slug`
- **THEN** Blog 内容 SHALL 使用 `/blog/:slug`
