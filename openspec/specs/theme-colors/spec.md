## ADDED Requirements

### Requirement: 主题配色系统

系统 SHALL 使用紫色系作为主色调，配合白色和灰色背景。

#### Scenario: 背景色显示
- **WHEN** 用户访问文档站
- **THEN** 页面背景 SHALL 为白色到浅紫色的渐变（225° 方向）

#### Scenario: 主色调使用
- **WHEN** 系统渲染强调元素
- **THEN** SHALL 使用 `#8264ff` 作为主色

### Requirement: 背景渐变效果

页面背景 SHALL 使用微妙的渐变色，从白色过渡到浅紫色，并带有 grid 栅格效果。

#### Scenario: 渐变方向
- **WHEN** 渲染页面背景
- **THEN** 渐变 SHALL 使用 225deg 方向（从左下到右上）

#### Scenario: 渐变颜色
- **WHEN** 渲染页面背景
- **THEN** 渐变 SHALL 从 `#ffffff` 0% 到 `#f5f3ff` 90% 到 `#ede9fe` 100%

#### Scenario: Grid 栅格效果
- **WHEN** 渲染页面背景
- **THEN** SHALL 显示 40px 网格栅格，使用 violet-500 低透明度线条

### Requirement: 标题样式

标题 SHALL 具有清晰的视觉层次和紫色强调。

#### Scenario: 一级标题显示
- **WHEN** 渲染 h1 标题
- **THEN** SHALL 使用深色文字并带有紫色下划线装饰

#### Scenario: 二级标题显示
- **WHEN** 渲染 h2 标题
- **THEN** SHALL 使用紫色左侧边框装饰

### Requirement: 超链接样式

超链接 SHALL 使用紫色显示，提升可点击识别度。

#### Scenario: 链接默认状态
- **WHEN** 渲染 prose 内链接
- **THEN** SHALL 使用 `#8264ff` 颜色

#### Scenario: 链接悬停状态
- **WHEN** 用户悬停链接
- **THEN** SHALL 变为 `#6b4fff`（更深）并显示下划线

### Requirement: 层次感设计（克制使用）

系统 SHALL 在关键位置使用线框/card 增加层次感，但需克制使用。

#### Scenario: 文档标题区域
- **WHEN** 渲染文档详情页标题区域
- **THEN** SHALL 使用浅色背景和线框包裹，增强层次感

#### Scenario: 非大范围使用
- **WHEN** 渲染页面内容
- **THEN** SHALL NOT 在大范围区域使用 card 或阴影效果