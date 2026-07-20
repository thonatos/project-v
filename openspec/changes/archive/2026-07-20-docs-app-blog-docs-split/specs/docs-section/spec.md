## ADDED Requirements

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

系统 SHALL 提供 `/docs` 路由，采用「左侧分类树 + 右侧按分类分组的卡片」布局展示全部 docs 文档。

#### Scenario: 访问 Docs 列表

- **WHEN** 用户访问 `/docs`
- **THEN** 右侧内容区 SHALL 按 `category` 分组展示 docs 文档卡片，与文章页共用同一分类树骨架

#### Scenario: Docs 为空

- **WHEN** 不存在任何 docs 文档
- **THEN** 页面 SHALL 展示空状态提示，而非报错

### Requirement: Docs 文章三栏布局

系统 SHALL 将 `/docs/:slug` 中 `type: docs` 文章渲染为三栏布局：左侧分类树 + 正文 + 右侧 TOC。

#### Scenario: 打开 docs 文章

- **WHEN** 用户打开一篇 docs 文章
- **THEN** 页面 SHALL 同时展示左侧分类树、正文（含标题/日期/标签）与右侧 TOC

#### Scenario: 无 TOC 时的布局

- **WHEN** 文章不含可提取的标题（TOC 为空）
- **THEN** 页面 SHALL 正常展示分类树与正文，不出现空白 TOC 列错位

### Requirement: 落地页 Docs 分区

落地页 `/` SHALL 包含一个 Docs 分区，按分类概览 docs 内容，并提供前往 `/docs` 的入口。

#### Scenario: 落地页展示 Docs 概览

- **WHEN** 用户访问 `/`
- **THEN** Docs 分区 SHALL 按 `category` 概览 docs 内容，并含「查看全部」跳转到 `/docs`
