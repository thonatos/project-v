# Spec Delta

## MODIFIED Requirements

### Requirement: React Router SSG 配置

系统 SHALL 在禁用 SSR 的前提下预渲染首页、Docs、Blog、Projects 及公开详情和兼容迁移路径。

#### Scenario: 禁用 SSR
- **GIVEN** docs-app 使用静态托管
- **WHEN** 执行生产构建
- **THEN** SSG 配置 SHALL 保持 `ssr: false`

#### Scenario: 配置预渲染路径
- **GIVEN** 站点存在 Docs、Blog 和 Projects
- **WHEN** 生成预渲染路径
- **THEN** 路径 SHALL 包含 `/`、`/docs`、`/blog`、`/projects`、`/projects/vela`
- **THEN** 路径 SHALL 包含全部 `/docs/:slug` 与 `/blog/:slug` 规范详情地址

#### Scenario: 配置兼容迁移路径
- **GIVEN** 站点存在历史 Blog 与 Tags 地址
- **WHEN** 生成预渲染路径
- **THEN** 构建 SHALL 包含可直接访问的历史 Blog 与 Tags 兼容路径
- **THEN** 构建 SHALL 不再生成标签聚合内容页

#### Scenario: 动态路径生成
- **GIVEN** 构建期可读取全部内容类型与 slug
- **WHEN** 系统生成预渲染路径
- **THEN** 路径 SHALL 按内容类型包含全部规范详情地址和所需历史兼容地址

## ADDED Requirements

### Requirement: 按内容类型生成动态路径

系统 SHALL 根据构建期内容类型生成 Docs 与 Blog 的规范详情路径，并为历史 Blog 地址生成兼容路径。

#### Scenario: 生成 Docs 详情路径
- **GIVEN** 一篇内容声明 `type: docs`
- **WHEN** 系统生成动态路径
- **THEN** 结果 SHALL 包含 `/docs/:slug`
- **THEN** 结果 SHALL 不包含该内容的 `/blog/:slug`

#### Scenario: 生成 Blog 详情与历史路径
- **GIVEN** 一篇内容声明 `type: blog`
- **WHEN** 系统生成动态路径
- **THEN** 结果 SHALL 包含规范地址 `/blog/:slug`
- **THEN** 结果 SHALL 包含历史兼容地址 `/docs/:slug`
