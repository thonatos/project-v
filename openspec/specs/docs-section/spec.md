# docs-section Specification

## Purpose
定义站点文档区域的内容组织、入口展示和详情访问行为，使用户能够发现、浏览并区分正式文档与其他内容类型。

## Requirements

### Requirement: Docs 分类树

系统 SHALL 在 Docs 区（`/docs` 与 `/docs/:slug`）提供左侧分类树，按 `category` 分组列出全部 docs 文档，支持导航到具体文章。

#### Scenario: 展示分类树

- **WHEN** 用户进入 Docs 区页面
- **THEN** 左侧 SHALL 展示各 `category` 及其下文档链接，桌面端（`lg` 及以上）常驻显示

#### Scenario: 高亮当前文章

- **WHEN** 用户正在阅读某篇 docs 文章
- **THEN** 分类树 SHALL 高亮该文章所属条目

#### Scenario: 移动端分类树

- **WHEN** 视口宽度小于 `lg`
- **THEN** 分类树 SHALL 收入抽屉，通过按钮展开/收起，复用现有移动端抽屉交互模式

### Requirement: Docs 列表页

系统 SHALL 提供 `/docs` 路由，采用左侧分类树与右侧紧凑文档索引展示全部 `type: docs` 内容，并排除 Blog 与 Projects。

#### Scenario: 访问 Docs 列表

- **GIVEN** 站点存在多个分类下的 Docs 内容
- **WHEN** 用户访问 `/docs`
- **THEN** 右侧内容区 SHALL 按 `category` 分组展示标题、摘要和更新时间
- **THEN** 页面 SHALL 与文档详情共用分类树

#### Scenario: Docs 不混入其他内容

- **GIVEN** 站点同时存在 Blog 和 Projects 内容
- **WHEN** 用户访问 `/docs`
- **THEN** 页面 SHALL 只展示 `type: docs` 内容

#### Scenario: Docs 为空

- **GIVEN** 不存在任何 Docs 内容
- **WHEN** 用户访问 `/docs`
- **THEN** 页面 SHALL 展示空状态提示，而非报错

### Requirement: Docs 文章三栏布局

系统 SHALL 将 `/docs/:slug` 中 `type: docs` 内容渲染为左侧分类树、正文和右侧 TOC 的阅读布局，并将日期表达为最近更新信息。

#### Scenario: 打开 docs 文章

- **GIVEN** slug 对应一篇 Docs 内容
- **WHEN** 用户打开 `/docs/:slug`
- **THEN** 页面 SHALL 同时展示分类树、正文和可用的 TOC
- **THEN** 标题区 SHALL 显示最近更新信息而非突出发布时序

#### Scenario: 无 TOC 时的布局

- **GIVEN** Docs 内容不含可提取的标题
- **WHEN** 用户打开该文档
- **THEN** 页面 SHALL 正常展示分类树与正文且不出现空白 TOC 列错位

### Requirement: 落地页 Docs 分区

落地页 `/` SHALL 包含一个 Docs 分区，按分类概览 docs 内容，并提供前往 `/docs` 的入口。

#### Scenario: 落地页展示 Docs 概览

- **WHEN** 用户访问 `/`
- **THEN** Docs 分区 SHALL 按 `category` 概览 docs 内容，并含「查看全部」跳转到 `/docs`
