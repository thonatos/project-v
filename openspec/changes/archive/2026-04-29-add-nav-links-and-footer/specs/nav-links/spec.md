## ADDED Requirements

### Requirement: 导航栏显示 Home 外部链接

系统必须在导航菜单栏中显示 Home 链接，允许用户点击跳转到项目首页。

#### Scenario: 用户点击 Home 链接跳转

- **WHEN** 用户点击导航栏中的 Home 链接
- **THEN** 浏览器在新标签页中打开项目首页 URL

#### Scenario: Home 链接键盘可访问

- **WHEN** 用户使用键盘导航聚焦到 Home 链接
- **THEN** 用户可通过 Enter 键激活链接跳转

### Requirement: 导航栏显示 GitHub 外部链接（仅图标）

系统必须在导航菜单栏中显示 GitHub 链接（仅使用图标，不显示文字），允许用户点击跳转到项目仓库。

#### Scenario: 用户点击 GitHub 图标跳转

- **WHEN** 用户点击导航栏中的 GitHub 图标
- **THEN** 浏览器在新标签页中打开 GitHub 仓库 URL

#### Scenario: GitHub 图标可访问性

- **WHEN** 屏幕阅读器用户聚焦到 GitHub 图标链接
- **THEN** 屏幕阅读器朗读链接用途（如 "访问 GitHub 仓库"）

### Requirement: 外部链接视觉区分

系统必须为外部链接提供视觉标识，区分内部路由链接和外部链接。

#### Scenario: 外部链接显示图标标识

- **WHEN** 用户查看导航栏中的外部链接
- **THEN** 每个外部链接显示对应图标（Home 或 GitHub 图标）

#### Scenario: 外部链接样式一致性

- **WHEN** 外部链接渲染时
- **THEN** 链接样式与导航栏内部链接保持视觉一致性（字体、颜色、间距）