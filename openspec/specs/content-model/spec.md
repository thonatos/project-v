# content-model Specification

## Purpose
TBD - created by archiving change docs-app-blog-docs-split. Update Purpose after archive.
## Requirements
### Requirement: 内容类型分类

系统 SHALL 通过每篇文档 frontmatter 的 `type` 字段将内容区分为 `blog` 与 `docs` 两种类型，`type` 为必填字段。

#### Scenario: blog 类型文档

- **WHEN** 文档 frontmatter 声明 `type: blog`
- **THEN** 该文档 SHALL 被归为 Blog 内容，参与 `/blog` 时间流与落地页 Blog 分区

#### Scenario: docs 类型文档

- **WHEN** 文档 frontmatter 声明 `type: docs`
- **THEN** 该文档 SHALL 被归为 Docs 内容，参与 `/docs` 与分类树

#### Scenario: 缺省 type 容错

- **WHEN** 文档 frontmatter 未声明 `type`
- **THEN** 系统 SHALL 将其默认按 `blog` 处理，并在构建日志输出告警，不得使该文档从站点消失

### Requirement: Docs 分类字段

系统 SHALL 支持 `docs` 类型文档通过 frontmatter 的 `category` 字段声明其所属分类；`blog` 类型文档不使用 `category`。

#### Scenario: docs 声明分类

- **WHEN** 一篇 `type: docs` 文档声明 `category: System & Server`
- **THEN** 该文档 SHALL 被归入 "System & Server" 分类下

#### Scenario: docs 缺省分类容错

- **WHEN** 一篇 `type: docs` 文档未声明 `category`
- **THEN** 系统 SHALL 将其归入 "Uncategorized" 分类，不得丢弃该文档

#### Scenario: blog 忽略分类

- **WHEN** 一篇 `type: blog` 文档携带 `category` 字段
- **THEN** 系统 SHALL 忽略该字段，不将其纳入 Docs 分类树

### Requirement: Frontmatter 解析

系统 SHALL 使用 gray-matter 解析文档 frontmatter，支持完整 YAML 语法（多行、数组、嵌套），替换原有手写正则解析器。

#### Scenario: 解析完整字段

- **WHEN** 构建期读取一篇含 `title`、`date`、`description`、`tags`、`type`、`category` 的文档
- **THEN** 系统 SHALL 正确解析全部字段并填充 `Doc` 数据结构

#### Scenario: 解析 YAML 数组标签

- **WHEN** 文档 `tags` 以 YAML 数组书写（`[a, b]` 或多行 `- a`）
- **THEN** 系统 SHALL 将其解析为字符串数组

### Requirement: 按类型与分类派生数据

系统 SHALL 提供按类型过滤与按分类分组的数据派生接口，供路由与落地页复用。

#### Scenario: 按类型获取文档

- **WHEN** 调用按类型获取接口并传入 `blog` 或 `docs`
- **THEN** 系统 SHALL 返回该类型的全部文档，并按日期倒序排列

#### Scenario: 按分类分组

- **WHEN** 请求 Docs 分类分组数据
- **THEN** 系统 SHALL 返回按 `category` 分组的结果，每组含分类名与该分类下的文档列表

