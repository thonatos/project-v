# docs-app-layouts

## ADDED Requirements

### Requirement: 多布局系统支持

docs-app SHALL 支持多种页面布局类型，以适应不同路由的内容结构需求。

#### Scenario: 基础布局用于通用页面
- **WHEN** 用户访问 `/`、`/tags`、`/tags/:tag` 等通用页面
- **THEN** 页面使用 `basic-layout.tsx` 布局，包含 Header、Footer 和居中内容容器

#### Scenario: 文档布局用于详情页
- **WHEN** 用户访问 `/docs/:slug` 文档详情页
- **THEN** 页面使用 `doc-layout.tsx` 布局，包含 Header、Footer、TOCProvider、MobileTOCDrawer 和 DesktopTOC 侧边栏

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