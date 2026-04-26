## ADDED Requirements

### Requirement: 路由页面配置
系统 SHALL 提供路由页面，使用 loader 加载文档数据。

#### Scenario: 首页路由
- **WHEN** 用户访问 `/`
- **THEN** 首页 loader 读取文档列表，页面渲染文档卡片

#### Scenario: 文档详情页路由
- **WHEN** 用户访问 `/docs/:slug`
- **THEN** 详情页 loader 读取文档内容，页面渲染文档详情

### Requirement: Loader 数据加载机制
系统 SHALL 使用 React Router loader 加载文档数据。

#### Scenario: 开发环境 loader 动态执行
- **WHEN** 开发环境用户访问页面
- **THEN** loader 在请求时执行，返回最新数据

#### Scenario: 生产环境 loader 预执行
- **WHEN** 生产环境 SSG 构建
- **THEN** loader 在构建时执行，数据嵌入静态 HTML

#### Scenario: loader 参数传递
- **WHEN** 详情页 loader 执行
- **THEN** 通过 `params.slug` 获取文档标识