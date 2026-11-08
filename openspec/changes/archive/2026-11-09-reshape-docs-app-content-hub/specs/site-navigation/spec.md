# Spec Delta

## MODIFIED Requirements

### Requirement: 主导航入口

Header SHALL 提供 Docs、Blog、Projects 三个主导航入口，并在桌面与移动视口保持可访问且可识别的当前分区状态。

#### Scenario: 桌面端导航

- **GIVEN** 用户使用桌面视口
- **WHEN** 用户查看任意页面
- **THEN** Header SHALL 展示 Docs（`/docs`）、Blog（`/blog`）、Projects（`/projects`）入口及 GitHub 链接
- **THEN** 当前分区使用不只依赖颜色的方式标识

#### Scenario: 移动端导航

- **GIVEN** 用户使用移动视口
- **WHEN** 用户查看任意页面
- **THEN** Header SHALL 提供 Docs、Blog、Projects 和 GitHub 入口
- **THEN** 导航文字不得相互挤压或溢出视口

#### Scenario: 键盘识别当前分区

- **GIVEN** 用户通过辅助技术浏览站点
- **WHEN** 当前页面属于 Docs、Blog 或 Projects
- **THEN** 对应一级入口 SHALL 暴露当前页面或当前分区语义

### Requirement: 落地页双分区聚合

落地页 `/` SHALL 聚合 Docs、Blog 与 Projects，形成可直接理解站点定位并进入三类内容的门户。

#### Scenario: 双分区展示

- **GIVEN** 站点存在公开文档、Blog 和项目
- **WHEN** 用户访问 `/`
- **THEN** 页面 SHALL 展示精选项目、最新 Blog 内容和 Docs 分类入口
- **THEN** 每个分区 SHALL 提供前往对应列表页的入口

#### Scenario: 路由预渲染完整

- **GIVEN** 站点内容可在构建时读取
- **WHEN** 执行构建
- **THEN** 系统 SHALL 预渲染首页、Docs、Blog、Projects 及其公开详情和兼容迁移路径
