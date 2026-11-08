# docs-ssg Specification

## Purpose
定义文档应用的静态站点生成、内容读取、Loader 数据注入和生产部署要求，确保构建产物可离线生成并稳定托管。

## Requirements

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

### Requirement: 文档读取脚本
系统 SHALL 提供脚本读取 `app/docs` 目录下的文档文件。

#### Scenario: 读取文档目录
- **WHEN** 执行 `getDocSlugs()` 函数
- **THEN** 返回所有文档的 slug 列表

#### Scenario: 读取单个文档
- **WHEN** 执行 `getDocBySlug(slug)` 函数
- **THEN** 返回文档的元数据和渲染后的 HTML 内容

#### Scenario: 解析 frontmatter
- **WHEN** 读取文档文件
- **THEN** 解析 YAML frontmatter 提取 title、date、description 字段

#### Scenario: Markdown 渲染
- **WHEN** 处理文档内容
- **THEN** Markdown 内容转换为 HTML（含 Shiki 语法高亮）

### Requirement: Loader 数据加载
系统 SHALL 在路由 loader 中加载文档数据，供预渲染使用。

#### Scenario: 首页 loader
- **WHEN** 首页 loader 执行
- **THEN** 返回文档列表数据供页面渲染

#### Scenario: 详情页 loader
- **WHEN** 文档详情页 loader 执行（构建时）
- **THEN** 返回文档详情数据供页面渲染

#### Scenario: 数据嵌入静态 HTML
- **WHEN** SSG 构建执行
- **THEN** loader 返回的数据直接嵌入预渲染的静态 HTML 中

### Requirement: SSG 生成静态站点
系统 SHALL 通过 React Router SSG 预渲染生成静态 HTML 站点。

#### Scenario: 生成静态 HTML 文件
- **WHEN** 执行 `pnpm build`
- **THEN** 每个预渲染路径生成对应的静态 HTML 文件

#### Scenario: 构建产物目录
- **WHEN** SSG 构建完成
- **THEN** 静态站点文件位于 `build/client/` 目录

#### Scenario: 静态资源生成
- **WHEN** SSG 构建完成
- **THEN** 构建产物包含 CSS、JS 等静态资源

### Requirement: 生产环境静态站点部署
系统 SHALL 将 `build/client/` 作为名为 `docs-app` 的 Cloudflare Worker 静态资源部署，并使用配置中固定的有效兼容日期；push `main` SHALL 触发 connected build，人工部署命令 SHALL 使用同一份配置。

#### Scenario: 部署静态站点
- **GIVEN** `main` 包含有效的 docs-app Worker 配置和成功的生产构建
- **WHEN** Cloudflare connected build 执行 `wrangler deploy`
- **THEN** 平台 SHALL 将 `build/client/` 发布到名为 `docs-app` 的 Worker
- **THEN** Wrangler SHALL 不报告 Worker 名称不匹配或缺少兼容日期

#### Scenario: 页面无 API 调用
- **GIVEN** docs-app 已成功部署
- **WHEN** 用户访问生产环境页面
- **THEN** 页面数据 SHALL 已嵌入静态 HTML，无需额外 API 获取

#### Scenario: 人工补发使用相同配置
- **GIVEN** connected build 需要人工补发或验证
- **WHEN** 维护者执行 `pnpm -F docs-app deploy`
- **THEN** Wrangler SHALL 使用仓库内同一 Worker 名称、兼容日期和静态资源目录配置

#### Scenario: 部署失败不视为发布完成
- **GIVEN** Cloudflare connected build 或 `wrangler deploy` 返回失败
- **WHEN** 维护者评估发布状态
- **THEN** 本次发布 SHALL 视为未完成
- **THEN** 维护者 SHALL 修复失败并重新触发部署后再进行生产验收

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
