# Spec Delta

## MODIFIED Requirements

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
