## Purpose

为移动端提供全屏抽屉式目录导航，通过 Header 导航栏按钮触发，确保目录完整展示和良好的阅读体验。
## Requirements
### Requirement: 移动端目录全屏抽屉展示
系统 SHALL 在移动端使用全屏抽屉展示目录，从右侧滑入。

#### Scenario: 抽屉全屏展示
- **WHEN** 用户在移动端展开 TOC
- **THEN** 目录抽屉以全屏宽度（w-full）从右侧滑入，无遮罩层

#### Scenario: 抽屉关闭
- **WHEN** 用户在移动端点击目录项或关闭按钮
- **THEN** 目录抽屉滑出，恢复原文档视图

### Requirement: 移动端目录按钮位置
系统 SHALL 在移动端将目录触发按钮放置在 Header 导航栏。

#### Scenario: 目录按钮显示位置
- **WHEN** 用户在移动端访问文档页面
- **THEN** 目录按钮通过 Portal 渲染到 Header 导航栏 slot，与 GitHub 链接并列

#### Scenario: 目录按钮样式
- **WHEN** 目录按钮渲染完成
- **THEN** 按钮使用简洁图标样式（h-4 w-4），与 Header 其他元素风格一致

### Requirement: 抽屉 Header 高度一致性
系统 SHALL 确保抽屉 Header 高度与页面 Header 一致。

#### Scenario: Header 高度对齐
- **WHEN** 抽屉展开
- **THEN** 抽屉 Header 高度为 h-14（56px），与页面 Header 导航栏一致

