# layout-width-system Specification

## Purpose
定义站点页面容器、内容宽度和响应式断点的统一体系，使不同页面类型在各类视口上保持一致的对齐、留白与可读性。

## Requirements

### Requirement: 三级布局宽度体系
系统 SHALL 提供 full、contained 与 reading 三种布局宽度模式，并通过统一 PageShell 按页面职责选用；full 允许页面自行组织全宽分区，contained 用于栏目索引，reading 用于窄幅正文或迁移提示。

#### Scenario: 展示页全宽
- **GIVEN** 页面需要自行组织跨栏或项目品牌分区
- **WHEN** 页面选择 full 模式
- **THEN** 内容 SHALL 使用可用视口宽度，并由页面内层控制可读边距

#### Scenario: 全宽页内容仍可读

- **GIVEN** full 页面包含文字与操作入口
- **WHEN** 页面渲染
- **THEN** 文字与操作 SHALL 包裹在有响应式边距的内层容器中

#### Scenario: 列表页居中
- **GIVEN** 页面是 Blog、Docs 或 Projects 列表与索引
- **WHEN** 页面选择 contained 模式
- **THEN** 内容 SHALL 在桌面端限制为 max-w-7xl 并居中

### Requirement: 透明浮层 Header
系统 SHALL 在 full 页面继续使用正常文档流中的统一 Header，不因页面采用 full 宽度而自动启用透明叠加或滚动变色。

#### Scenario: 顶部透明浮层
- **GIVEN** 页面选择 full 模式
- **WHEN** 用户访问该页面
- **THEN** Header SHALL 位于页面内容上方且保持统一背景与分隔边界

#### Scenario: 滚动后实心
- **GIVEN** 用户滚动 full 页面
- **WHEN** Header 保持 sticky
- **THEN** Header SHALL 保持统一背景与分隔边界，不发生透明到实心的模式切换

### Requirement: 文章按需宽度切换
系统 SHALL 支持文章通过 frontmatter 字段 `layout: reading | wide` 选择定宽阅读或宽版布局，缺省为 reading，且不影响未声明该字段的既有文档。

#### Scenario: 默认定宽阅读
- **WHEN** 文章 frontmatter 未声明 layout
- **THEN** 文章以 reading 宽度渲染

#### Scenario: 显式宽版
- **WHEN** 文章 frontmatter 声明 `layout: wide`
- **THEN** 文章以更宽的布局渲染以容纳宽表格/大图

#### Scenario: 兼容既有文档
- **WHEN** 解析未包含 layout 字段的旧文档
- **THEN** 解析成功且按 reading 宽度渲染，不报错
