# blog-section Specification

## Purpose
定义站点博客区域的内容来源、列表展示和文章访问行为，使非文档类内容能够独立组织、稳定路由，并与文档区域保持清晰边界。

## Requirements

### Requirement: Blog 时间流列表

系统 SHALL 提供 `/blog` 路由，以时间流按日期倒序展示全部 `type: blog` 内容，并允许读者在全部、技术与工程、股票与市场三个稳定栏目之间选择。

#### Scenario: 访问 Blog 列表

- **GIVEN** 站点存在多个栏目下的 Blog 内容
- **WHEN** 用户访问 `/blog`
- **THEN** 页面 SHALL 按日期从新到旧展示全部 Blog
- **THEN** 每项包含标题、日期、描述与栏目，不显示可点击标签导航

#### Scenario: 筛选 Blog 栏目

- **GIVEN** Blog 同时存在技术与工程、股票与市场内容
- **WHEN** 用户选择其中一个栏目
- **THEN** 页面 SHALL 只显示该栏目内容
- **THEN** 当前栏目 SHALL 以不只依赖颜色的方式标识

#### Scenario: Blog 为空

- **GIVEN** 不存在任何 Blog 内容
- **WHEN** 用户访问 `/blog`
- **THEN** 页面 SHALL 展示空状态提示，而非报错

### Requirement: 落地页 Blog 分区

落地页 `/` SHALL 包含最新 Blog 内容，并区分技术与工程、股票与市场栏目，同时提供前往 `/blog` 的入口。

#### Scenario: 落地页展示最近 Blog

- **GIVEN** 站点存在 Blog 内容
- **WHEN** 用户访问 `/`
- **THEN** Blog 分区 SHALL 展示最近发布内容及其栏目
- **THEN** 分区 SHALL 提供前往 `/blog` 的入口

### Requirement: Blog 文章可访问

Blog 内容 SHALL 通过 `/blog/:slug` 渲染正文、日期、栏目与 TOC，并使用不含 Docs 分类树的阅读布局。

#### Scenario: 打开 blog 文章

- **GIVEN** slug 对应一篇 Blog 内容
- **WHEN** 用户访问 `/blog/:slug`
- **THEN** 系统 SHALL 渲染其标题、描述、发布日期、栏目、正文与 TOC
- **THEN** 页面 SHALL 不显示 Docs 分类目录

#### Scenario: 打开不存在的 Blog 文章

- **GIVEN** slug 不对应任何 Blog 内容
- **WHEN** 用户访问 `/blog/:slug`
- **THEN** 系统 SHALL 显示未找到状态而不是错误的 Docs 内容
