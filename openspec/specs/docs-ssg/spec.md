## ADDED Requirements

### Requirement: React Router SSG 配置
系统 SHALL 在 `react-router.config.ts` 中配置 SSG 预渲染。

#### Scenario: 禁用 SSR
- **WHEN** 配置 SSG
- **THEN** `react-router.config.ts` 设置 `ssr: false`

#### Scenario: 配置预渲染路径
- **WHEN** 配置预渲染
- **THEN** `prerender()` 函数返回首页 `/` 和所有文档详情页路径 `/docs/:slug`

#### Scenario: 动态路径生成
- **WHEN** 存在动态路由 `/docs/:slug`
- **THEN** 通过读取 `app/docs` 目录获取所有 slug，生成完整路径列表

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
系统 SHALL 在生产环境部署静态站点，无需服务器运行时。

#### Scenario: 部署静态站点
- **WHEN** 部署 `build/client/` 到静态托管平台
- **THEN** 站点可正常访问，所有页面为静态 HTML

#### Scenario: 页面无 API 调用
- **WHEN** 用户访问生产环境页面
- **THEN** 页面数据已嵌入静态 HTML，无需额外 API 获取