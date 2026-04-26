## MODIFIED Requirements

### Requirement: 站点标题配置
系统 SHALL 配置站点标题为 "ρV"，描述为 "undefined project"，并为品牌名添加防翻译标记。

#### Scenario: 显示站点标题
- **WHEN** 用户访问任意页面
- **THEN** 导航栏 Logo 显示 "ρV"，品牌名被 `translate="no"` 包裹

#### Scenario: 页面 meta 标题
- **WHEN** 页面渲染完成
- **THEN** 浏览器标签页显示 "ρV" 或 "ρV - 文档标题"

#### Scenario: 站点描述
- **WHEN** 用户查看站点 meta 信息
- **THEN** 站点描述显示为 "undefined project"

## ADDED Requirements

### Requirement: Theme Color Meta 标签
系统 SHALL 添加 `theme-color` meta 标签，匹配页面背景色。

#### Scenario: Theme Color 配置
- **WHEN** 页面渲染完成
- **THEN** `<meta name="theme-color" content="#ffffff">` 存在于 head 中

### Requirement: Scroll Margin Top
系统 SHALL 为标题添加 `scroll-margin-top`，确保锚点跳转正确对齐。

#### Scenario: 标题锚点跳转
- **WHEN** 用户点击标题锚点链接
- **THEN** 页面滚动后标题不被 Header 遮挡（scroll-margin-top: 4rem）

### Requirement: 主内容区域标识
系统 SHALL 为主内容区域添加 `id="main-content"`，支持 Skip Link 跳转。

#### Scenario: 主内容区域 ID
- **WHEN** 页面渲染完成
- **THEN** 主内容区域（Outlet）具有 `id="main-content"`