# Spec Delta

## MODIFIED Requirements

### Requirement: 多布局系统支持

docs-app SHALL 使用统一 Header 与 Footer，并为通用索引、Docs 详情、Blog 详情和项目专页提供与内容职责匹配的布局。

#### Scenario: 基础布局用于通用页面
- **GIVEN** 用户访问 `/`、`/blog`、`/docs` 或 `/projects`
- **WHEN** 页面渲染
- **THEN** 页面 SHALL 使用统一站点外壳和适合该内容列表的信息密度

#### Scenario: 文档布局用于详情页
- **GIVEN** 用户访问一篇 Docs 内容
- **WHEN** 页面渲染
- **THEN** 页面 SHALL 提供 Docs 分类目录、正文以及可用的本页 TOC

#### Scenario: Blog 使用阅读型布局
- **GIVEN** 用户访问一篇 Blog 内容
- **WHEN** 页面渲染
- **THEN** 页面 SHALL 提供正文和可用的本页 TOC，且不显示 Docs 分类目录

#### Scenario: Projects 使用品牌型布局
- **GIVEN** 用户访问项目专页
- **WHEN** 页面渲染
- **THEN** 页面 SHALL 保留统一站点外壳并允许正文使用该项目的品牌标志、色彩和构图
