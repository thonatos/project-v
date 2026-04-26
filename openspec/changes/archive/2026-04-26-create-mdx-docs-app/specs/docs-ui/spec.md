## ADDED Requirements

### Requirement: 文章列表页布局
系统 SHALL 采用 Tailwind CSS Blog 风格的文章列表页，简洁卡片式布局。

#### Scenario: 显示文章卡片列表
- **WHEN** 用户访问首页或列表页
- **THEN** 页面显示文章卡片列表，每张卡片包含日期、标题、摘要

#### Scenario: 点击文章卡片跳转
- **WHEN** 用户点击文章卡片标题
- **THEN** 系统跳转到对应文章详情页

### Requirement: 简约单列布局
系统 SHALL 采用 Compass 风格的简约单列布局，以内容为核心，无复杂侧边栏。

#### Scenario: 内容流式布局
- **WHEN** 用户访问任意文档页面
- **THEN** 页面呈现单列内容流，顶部有简洁导航栏，底部有页脚

### Requirement: 响应式设计
系统 SHALL 支持响应式布局，在不同屏幕尺寸下正确显示。

#### Scenario: 桌面端布局（≥1024px）
- **WHEN** 用户在桌面设备访问页面
- **THEN** 内容区宽度适中（约 768px），TOC 在右侧显示

#### Scenario: 平板布局（768px-1023px）
- **WHEN** 用户在平板设备访问页面
- **THEN** 内容区宽度自适应，TOC 隐藏或折叠

#### Scenario: 移动端布局（<768px）
- **WHEN** 用户在移动设备访问页面
- **THEN** 内容区全宽显示，TOC 折叠为底部浮动按钮或隐藏

### Requirement: 目录大纲（TOC）
系统 SHALL 提供文章目录大纲组件，显示文档的标题层级结构。

#### Scenario: 显示 TOC 组件
- **WHEN** 文档包含多个标题（h2、h3 等）
- **THEN** 页面右侧显示 TOC 组件，列出所有标题链接

#### Scenario: TOC 高亮当前章节
- **WHEN** 用户滚动文档内容
- **THEN** TOC 自动高亮当前可见的章节标题

#### Scenario: 点击 TOC 跳转
- **WHEN** 用户点击 TOC 中的标题链接
- **THEN** 页面滚动到对应标题位置

#### Scenario: TOC 响应式适配
- **WHEN** 屏幕宽度小于 1024px
- **THEN** TOC 隐藏或改为底部浮动按钮触发

### Requirement: 清晰的排版层次
系统 SHALL 提供清晰的排版层次，便于阅读长文档。

#### Scenario: 显示标题层级
- **WHEN** 文档包含多级标题
- **THEN** 不同层级标题使用明确的视觉层级区分（字体大小、间距）

#### Scenario: 显示代码块
- **WHEN** 文档包含代码块
- **THEN** 代码块带有文件名标签，使用深色背景和语法高亮

#### Scenario: 分隔章节
- **WHEN** 文档包含多个章节
- **THEN** 章节之间使用淡色分隔线或间距区分

### Requirement: 顶部导航
系统 SHALL 提供简洁的顶部导航栏，包含站点 Logo 和基础链接。

#### Scenario: 显示顶部导航
- **WHEN** 用户访问任意页面
- **THEN** 顶部显示站点 Logo、首页链接和主题切换按钮

### Requirement: 暗色模式支持
系统 SHALL 支持暗色模式，与系统主题偏好同步。

#### Scenario: 自动跟随系统主题
- **WHEN** 用户系统设置为暗色模式
- **THEN** 文档站点自动应用暗色主题

#### Scenario: 手动切换主题
- **WHEN** 用户点击主题切换按钮
- **THEN** 站点切换到对应的亮色或暗色主题

### Requirement: 图片自适应主题
系统 SHALL 支持图片根据当前主题自动切换亮色/暗色版本。

#### Scenario: 显示主题自适应图片
- **WHEN** 文档包含使用 `{scheme}` 占位符的图片路径
- **THEN** 系统根据当前主题自动加载对应的 `light` 或 `dark` 图片