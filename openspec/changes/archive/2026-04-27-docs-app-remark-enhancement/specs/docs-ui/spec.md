## ADDED Requirements

### Requirement: 文档页面全屏宽度布局
系统 SHALL 使用全屏宽度布局显示文档页面，移除 max-w-3xl 限制。

#### Scenario: 桌面端全屏布局
- **WHEN** 用户在桌面端访问文档页面
- **THEN** 文档内容区域使用接近全屏宽度

#### Scenario: 内容边距保持
- **WHEN** 文档内容区域使用全屏宽度
- **THEN** 保持适当边距确保阅读舒适

### Requirement: TOC 侧边栏布局
系统 SHALL 在文档页面提供 TOC 侧边栏布局。

#### Scenario: TOC 固定定位
- **WHEN** 文档页面渲染
- **THEN** TOC 侧边栏使用 sticky 定位跟随滚动

#### Scenario: TOC 与内容并排
- **WHEN** 桌面端布局
- **THEN** TOC 侧边栏与文档内容并排显示

### Requirement: 站点标题配置
系统 SHALL 配置站点标题为 "ρV"，描述为 "undefined project"。

#### Scenario: 显示站点标题
- **WHEN** 用户访问任意页面
- **THEN** 导航栏 Logo 显示 "ρV"

#### Scenario: 页面 meta 标题
- **WHEN** 页面渲染完成
- **THEN** 浏览器标签页显示 "ρV" 或 "ρV - 文档标题"

#### Scenario: 站点描述
- **WHEN** 用户查看站点 meta 信息
- **THEN** 站点描述显示为 "undefined project"

### Requirement: Footer 版权声明
系统 SHALL 在 Footer 显示完整的版权声明。

#### Scenario: 显示版权信息
- **WHEN** 用户访问任意页面
- **THEN** Footer 显示版权年份和所有者信息

### Requirement: Footer 外部链接
系统 SHALL 在 Footer 显示相关外部链接。

#### Scenario: 显示项目链接
- **WHEN** Footer 渲染完成
- **THEN** Footer 显示 GitHub 仓库链接或其他相关链接