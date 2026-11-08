# docs-full-width-layout Specification

## Purpose
定义文档详情页的全宽内容布局与目录侧栏协作方式，使宽屏内容充分利用可用空间，同时保持导航区域稳定可用。

## Requirements

### Requirement: 文档页面全屏宽度
系统 SHALL 让 Docs 索引与详情共用 max-w-7xl 页面骨架、220px 分类栏和统一外边距；详情正文在剩余宽度内按 TOC 是否存在分配空间。

#### Scenario: 桌面端全屏布局
- **GIVEN** 用户在桌面端访问 Docs 索引或详情
- **WHEN** 页面渲染
- **THEN** 两类页面 SHALL 使用相同的外层宽度、分类栏宽度、列间距与正文左边界

#### Scenario: 内容边距保持
- **GIVEN** Docs 页面使用统一骨架
- **WHEN** 页面在支持的视口中渲染
- **THEN** 内容 SHALL 保持响应式水平与垂直边距

#### Scenario: 移动端布局
- **GIVEN** 用户在移动端访问 Docs 页面
- **WHEN** 页面渲染
- **THEN** 内容 SHALL 适应屏幕宽度且不产生页面级水平溢出

### Requirement: TOC 侧边栏布局
系统 SHALL 在文档页面右侧显示 TOC 侧边栏。

#### Scenario: TOC 固定定位
- **WHEN** 文档页面渲染
- **THEN** TOC 侧边栏使用 sticky 定位，跟随文档内容滚动

#### Scenario: TOC 与内容布局
- **WHEN** 桌面端布局
- **THEN** TOC 侧边栏与文档内容并排显示（grid 或 flex 布局）

#### Scenario: 移动端隐藏 TOC
- **WHEN** 移动端布局
- **THEN** TOC 侧边栏默认隐藏，通过按钮或手势展开
