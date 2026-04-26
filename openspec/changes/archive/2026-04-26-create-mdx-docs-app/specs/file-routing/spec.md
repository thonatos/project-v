## ADDED Requirements

### Requirement: MDX 文件直接作为路由
系统 SHALL 支持 `.mdx` 文件直接放置在 `routes/` 目录作为静态路由。

#### Scenario: MDX 文件生成静态路由
- **WHEN** 存在 `app/routes/docs/getting-started.mdx` 文件
- **THEN** 系统自动生成 `/docs/getting-started` 路由

#### Scenario: 支持嵌套布局
- **WHEN** 存在 `app/routes/_layout.tsx` 布局文件
- **THEN** 所有 MDX 路由页面在布局组件内渲染

### Requirement: Frontmatter 元数据提取
系统 SHALL 从 MDX 文件的 frontmatter 提取元数据（标题、日期、摘要）。

#### Scenario: 提取 frontmatter 元数据
- **WHEN** MDX 文件包含 YAML frontmatter
- **THEN** 系统提取 `title`、`date`、`description` 等字段供首页列表使用

#### Scenario: 元数据用于文章列表
- **WHEN** 首页需要显示文章列表
- **THEN** 通过 glob import 读取所有 MDX 文件的 frontmatter 生成卡片列表

### Requirement: 路由元数据配置
系统 SHALL 支持每个路由配置独立的 meta 标签。

#### Scenario: 配置页面 meta 标签
- **WHEN** MDX 文件包含 frontmatter 的 `title` 和 `description`
- **THEN** 页面渲染时应用对应的 `<title>` 和 `<meta description>` 标签