# layout-width-system Specification

## Purpose
TBD - created by archiving change docs-app-visual-revamp. Update Purpose after archive.
## Requirements
### Requirement: 三级布局宽度体系
系统 SHALL 提供三种布局宽度模式：full-bleed（100vw 无边距，WebGL 舞台）、contained（max-w-7xl 居中，常规内容）、reading（max-w-3xl 居中，正文阅读），并通过统一的 PageShell 容器组件按页面职能选用。

#### Scenario: 展示页全宽
- **WHEN** 渲染首页或标签云页
- **THEN** WebGL 舞台以 full-bleed 铺满视口宽度

#### Scenario: 全宽页内容仍可读
- **WHEN** full-bleed 页面内渲染文字/入口
- **THEN** 文字内容包裹在内层 contained 容器中保持可读行宽

#### Scenario: 列表页居中
- **WHEN** 渲染 Blog/Docs 列表页
- **THEN** 内容以 contained 宽度居中

### Requirement: 透明浮层 Header
系统 SHALL 在 full-bleed 页面将 Header 渲染为透明玻璃浮层叠加于 WebGL 之上，并在页面滚动越过阈值后渐变为实心背景。

#### Scenario: 顶部透明浮层
- **WHEN** 用户位于 full-bleed 页顶部
- **THEN** Header 背景透明并叠加在 WebGL 舞台之上

#### Scenario: 滚动后实心
- **WHEN** 用户向下滚动越过阈值
- **THEN** Header 渐变为带背景的实心状态以保证可读性

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

