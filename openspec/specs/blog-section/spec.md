# blog-section Specification

## Purpose
TBD - created by archiving change docs-app-blog-docs-split. Update Purpose after archive.
## Requirements
### Requirement: Blog 时间流列表

系统 SHALL 提供 `/blog` 路由，以时间流形式按日期倒序展示全部 `type: blog` 文档。

#### Scenario: 访问 Blog 列表

- **WHEN** 用户访问 `/blog`
- **THEN** 页面 SHALL 展示全部 blog 文档，按日期从新到旧排列，每项含标题、日期、描述与标签

#### Scenario: Blog 为空

- **WHEN** 不存在任何 blog 文档
- **THEN** 页面 SHALL 展示空状态提示，而非报错

### Requirement: 落地页 Blog 分区

落地页 `/` SHALL 包含一个 Blog 分区，预览最近若干篇 blog 文档，并提供前往 `/blog` 的入口。

#### Scenario: 落地页展示最近 Blog

- **WHEN** 用户访问 `/`
- **THEN** Blog 分区 SHALL 展示按日期倒序的最近若干篇 blog 文档，并含「查看全部」跳转到 `/blog`

### Requirement: Blog 文章可访问

blog 文档 SHALL 通过 `/docs/:slug` 正常渲染其正文与目录（沿用现有文章渲染管线）。

#### Scenario: 打开 blog 文章

- **WHEN** 用户点击某篇 blog 文档
- **THEN** 系统 SHALL 渲染其正文、日期、标签与 TOC

