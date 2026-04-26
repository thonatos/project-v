## ADDED Requirements

### Requirement: 首页文档列表布局
系统 SHALL 在首页展示文档列表，使用卡片网格布局。

#### Scenario: 显示文档卡片列表
- **WHEN** 用户访问首页
- **THEN** 页面显示文档卡片列表，每张卡片包含日期、标题、摘要

#### Scenario: 桌面端网格布局
- **WHEN** 用户在桌面设备（≥1024px）访问首页
- **THEN** 文档卡片以 2 列网格显示

#### Scenario: 移动端单列布局
- **WHEN** 用户在移动设备（<768px）访问首页
- **THEN** 文档卡片以单列显示

### Requirement: 文档卡片点击跳转
系统 SHALL 支持点击文档卡片跳转到详情页。

#### Scenario: 点击文档卡片跳转
- **WHEN** 用户点击文档卡片标题
- **THEN** 系统跳转到对应文档详情页 `/docs/:slug`

### Requirement: 首页 Hero 区域
系统 SHALL 在首页顶部显示 Hero 区域。

#### Scenario: 显示 Hero 区域
- **WHEN** 用户访问首页
- **THEN** 页面顶部显示站点标题 "ρV" 和描述 "undefined project"

#### Scenario: Hero 区域响应式适配
- **WHEN** 用户在不同屏幕尺寸访问首页
- **THEN** Hero 区域标题和描述文字大小适配屏幕尺寸