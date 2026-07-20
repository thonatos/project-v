# site-navigation Specification

## Purpose
TBD - created by archiving change docs-app-blog-docs-split. Update Purpose after archive.
## Requirements
### Requirement: 主导航入口

Header SHALL 提供 Blog、Docs、Tags 三个主导航入口，桌面端常驻显示，指向对应路由。

#### Scenario: 桌面端导航

- **WHEN** 用户在桌面端查看任意页面
- **THEN** Header SHALL 展示 Blog（`/blog`）、Docs（`/docs`）、Tags（`/tags`）入口及 GitHub 链接

#### Scenario: 移动端导航

- **WHEN** 用户在移动端查看任意页面
- **THEN** Header SHALL 以适配移动端的方式提供 Blog、Docs、Tags 入口，不破坏现有布局

### Requirement: 落地页双分区聚合

落地页 `/` SHALL 将 Blog 分区与 Docs 分区聚合于一页，形成双栏并存的站点门户。

#### Scenario: 双分区展示

- **WHEN** 用户访问 `/`
- **THEN** 页面 SHALL 依次呈现 Blog 分区与 Docs 分区，各自带有前往对应列表页的入口

#### Scenario: 路由预渲染完整

- **WHEN** 执行构建
- **THEN** 系统 SHALL 预渲染 `/`、`/blog`、`/docs`、`/docs/:slug`、`/tags`、`/tags/:tag` 全部路由产物

