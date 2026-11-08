# Spec Delta

## Purpose

定义既有公开内容地址迁移后的兼容行为，使收藏、外部引用和搜索结果中的旧 Blog 与 Tags 链接仍能把访问者带到新的有效内容入口。

## ADDED Requirements

### Requirement: 旧 Blog 正文地址兼容

系统 SHALL 将位于 `/docs/:slug` 的既有 Blog 内容请求迁移到该内容的规范地址 `/blog/:slug`，且 Docs 内容继续在原地址呈现。

#### Scenario: 访问旧 Blog 地址
- **GIVEN** slug 对应一篇 `type: blog` 的现有内容
- **WHEN** 用户直接访问 `/docs/:slug`
- **THEN** 系统将用户带到 `/blog/:slug`
- **THEN** 新地址展示同一篇文章

#### Scenario: 访问现有 Docs 地址
- **GIVEN** slug 对应一篇 `type: docs` 的现有内容
- **WHEN** 用户直接访问 `/docs/:slug`
- **THEN** 系统继续在该地址展示文档，不发生 Blog 路由迁移

### Requirement: 旧 Tags 地址兼容

系统 SHALL 在 Tags 页面下线后为 `/tags` 和 `/tags/:tag` 提供有效退路，不向用户显示失效页面或空标签页。

#### Scenario: 访问旧标签索引
- **GIVEN** Tags 已不再是站点一级内容
- **WHEN** 用户直接访问 `/tags`
- **THEN** 系统将用户带到 `/blog`

#### Scenario: 访问旧标签详情
- **GIVEN** Tags 聚合页已下线
- **WHEN** 用户直接访问 `/tags/:tag`
- **THEN** 系统将用户带到 `/blog`

### Requirement: 规范站内链接

站内导航 SHALL 直接指向当前规范 URL，不依赖兼容迁移才能到达 Docs、Blog 或 Projects 内容。

#### Scenario: 打开 Blog 文章
- **GIVEN** 页面展示一篇 Blog 内容的链接
- **WHEN** 用户激活该链接
- **THEN** 链接直接进入 `/blog/:slug`

#### Scenario: 打开 Docs 文档
- **GIVEN** 页面展示一篇 Docs 内容的链接
- **WHEN** 用户激活该链接
- **THEN** 链接直接进入 `/docs/:slug`
