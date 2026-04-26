## ADDED Requirements

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