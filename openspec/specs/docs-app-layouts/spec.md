# docs-app-layouts Specification

## Purpose
定义文档应用的多布局体系、统一页面容器和布局导出约定，使各类页面能够复用稳定的结构并保持一致的宽度与间距。

## Requirements

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

### Requirement: 统一页面容器

所有页面内容容器 SHALL 使用统一的样式类：`px-4 sm:px-6 lg:px-8 py-12 lg:max-w-7xl lg:mx-auto`。

#### Scenario: 响应式边距
- **WHEN** 页面在移动端渲染
- **THEN** 内容容器使用 `px-4 py-12` 边距
- **WHEN** 页面在平板端渲染
- **THEN** 内容容器使用 `sm:px-6` 边距
- **WHEN** 页面在桌面端渲染
- **THEN** 内容容器使用 `lg:px-8` 边距且最大宽度限制为 `lg:max-w-7xl lg:mx-auto`

### Requirement: 布局组件导出规范

布局组件 SHALL 使用大写命名法导出为具名导出。

#### Scenario: Header 和 Footer 组件命名
- **WHEN** 其他组件导入 Header 或 Footer
- **THEN** 导入路径为 `~/components/header` 和 `~/components/footer`（小写）

#### Scenario: 组件文件命名
- **WHEN** 组件文件被创建或重命名
- **THEN** 文件名使用 kebab-case 命名法，如 `header.tsx`、`footer.tsx`、`basic-layout.tsx`
