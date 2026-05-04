## ADDED Requirements

### Requirement: 导航栏布局结构

导航栏 SHALL 采用左右分栏布局，左侧为 logo，右侧为导航链接区域。

#### Scenario: 左侧 logo 区域
- **WHEN** 渲染导航栏
- **THEN** 左侧 SHALL 显示 logo（文字 "ρV undefined project"）

#### Scenario: 右侧链接区域
- **WHEN** 渲染导航栏右侧
- **THEN** SHALL 显示导航链接，导航组与 GitHub 用竖线分割

#### Scenario: 竖线分割样式
- **WHEN** 渲染导航链接与 GitHub
- **THEN** 导航链接组与 GitHub SHALL 使用浅灰色竖线分割

### Requirement: 导航链接结构

导航栏 SHALL 包含 All Tags、Technical、Trading 页面链接和 GitHub 外部链接。

#### Scenario: 导航链接显示
- **WHEN** 用户在桌面端访问文档站
- **THEN** 导航栏 SHALL 显示 "All Tags"、"Technical"、"Trading" 链接和 GitHub 图标

#### Scenario: 响应式导航
- **WHEN** 用户在移动端访问文档站
- **THEN** 导航链接 SHALL 隐藏，仅显示 TOC 按钮（如有）和 GitHub 图标

### Requirement: All Tags 页面路由

系统 SHALL 提供 `/tags` 路由展示所有标签（卡片网格布局）。

#### Scenario: All Tags 页面访问
- **WHEN** 用户点击 All Tags 导航链接
- **THEN** 系统 SHALL 导航到 `/tags` 页面

#### Scenario: All Tags 页面布局
- **WHEN** 用户访问 `/tags` 页面
- **THEN** 系统 SHALL 显示卡片网格布局，每个卡片包含标签名、文档数、预览文档

### Requirement: Technical 页面路由

系统 SHALL 提供 `/tech` 路由展示技术相关文档（linux、docker、network 等）。

#### Scenario: Technical 页面访问
- **WHEN** 用户点击 Technical 导航链接
- **THEN** 系统 SHALL 导航到 `/tech` 页面，展示技术相关文档

#### Scenario: Technical 页面内容
- **WHEN** 用户访问 `/tech` 页面
- **THEN** 系统 SHALL 显示筛选后的技术文档列表，顶部显示相关标签云

### Requirement: Trading 页面路由

系统 SHALL 提供 `/trading` 路由展示交易相关文档（trading、investment、stock 等）。

#### Scenario: Trading 页面访问
- **WHEN** 用户点击 Trading 导航链接
- **THEN** 系统 SHALL 导航到 `/trading` 页面，展示交易相关文档

#### Scenario: Trading 页面内容
- **WHEN** 用户访问 `/trading` 页面
- **THEN** 系统 SHALL 显示筛选后的交易文档列表，顶部显示相关标签云

### Requirement: GitHub 链接

导航栏 SHALL 包含指向 GitHub 仓库的外部链接图标。

#### Scenario: GitHub 链接点击
- **WHEN** 用户点击 GitHub 图标
- **THEN** SHALL 在新标签页打开 `https://github.com/thonatos/project-v`

### Requirement: 移动端 TOC 与 GitHub 分割

移动端 SHALL 在 TOC 按钮（如存在）与 GitHub 之间使用分割线。

#### Scenario: TOC 存在时显示分割线
- **WHEN** 文档页有目录且 TOC 按钮渲染
- **THEN** TOC 按钮与 GitHub SHALL 使用竖线分割