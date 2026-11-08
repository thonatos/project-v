# Spec Delta

## MODIFIED Requirements

### Requirement: 首页文档列表布局

系统 SHALL 在首页提供 Docs 分类概览、最新 Blog 与精选 Projects，并通过不同的信息密度区分三类内容。

#### Scenario: 显示文档卡片列表
- **GIVEN** 站点存在 Docs、Blog 和 Projects 内容
- **WHEN** 用户访问首页
- **THEN** 页面显示 Docs 分类入口、最新 Blog 条目和精选项目

#### Scenario: 桌面端网格布局
- **GIVEN** 用户使用桌面设备访问首页
- **WHEN** 页面展示内容门户
- **THEN** 三类内容利用可用宽度形成清晰分区且精选项目具有明确视觉重点

#### Scenario: 移动端单列布局
- **GIVEN** 用户使用移动设备访问首页
- **WHEN** 页面展示内容门户
- **THEN** Docs、Blog 与 Projects 按单列顺序展示且不依赖横向滚动

### Requirement: 文档卡片点击跳转

系统 SHALL 让首页上的 Docs、Blog 和 Projects 内容入口直接跳转到各自的规范详情地址。

#### Scenario: 点击文档卡片跳转
- **GIVEN** 首页展示一个 Docs 条目
- **WHEN** 用户点击该条目
- **THEN** 系统跳转到对应 `/docs/:slug`

#### Scenario: 点击 Blog 条目
- **GIVEN** 首页展示一个 Blog 条目
- **WHEN** 用户点击该条目
- **THEN** 系统跳转到对应 `/blog/:slug`

#### Scenario: 点击精选项目
- **GIVEN** 首页展示 Vela 精选项目
- **WHEN** 用户点击项目详情入口
- **THEN** 系统跳转到 `/projects/vela`

### Requirement: 首页 Hero 区域

系统 SHALL 在首页顶部用紧凑 Hero 说明站点用于沉淀知识、分享思考与呈现项目，并提供 Docs、Blog、Projects 三类内容入口。

#### Scenario: 显示 Hero 区域
- **GIVEN** 用户首次访问站点
- **WHEN** 首页完成渲染
- **THEN** Hero 显示品牌、站点定位以及 Docs、Blog、Projects 入口
- **THEN** 页面不要求用户滚动后才能理解主要内容类型

#### Scenario: Hero 区域响应式适配
- **GIVEN** 用户使用任意受支持屏幕尺寸
- **WHEN** 用户访问首页
- **THEN** Hero 的标题、说明和入口适配可用宽度且不发生文字或操作溢出
