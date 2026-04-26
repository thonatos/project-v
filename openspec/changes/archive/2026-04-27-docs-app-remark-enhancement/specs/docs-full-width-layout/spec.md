## ADDED Requirements

### Requirement: 文档页面全屏宽度
系统 SHALL 使用全屏宽度布局显示文档内容。

#### Scenario: 桌面端全屏布局
- **WHEN** 用户在桌面端访问文档页面
- **THEN** 文档内容区域使用 `w-full` 或接近全屏宽度（移除 max-w-3xl 限制）

#### Scenario: 内容边距保持
- **WHEN** 文档内容区域使用全屏宽度
- **THEN** 保持适当边距（px-4 sm:px-6 lg:px-8）确保阅读舒适

#### Scenario: 移动端布局
- **WHEN** 用户在移动端访问文档页面
- **THEN** 保持响应式布局，内容区域适应屏幕宽度

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