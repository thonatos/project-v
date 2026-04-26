## ADDED Requirements

### Requirement: 文档存储位置
系统 SHALL 将文档存储在 `app/docs` 目录下。

#### Scenario: 文档目录结构
- **WHEN** 系统读取文档目录
- **THEN** `app/docs` 目录下包含 `.md` 文档文件

#### Scenario: 文档文件格式
- **WHEN** 创建新文档
- **THEN** 文档使用 `.md` 或 `.markdown` 扩展名

#### Scenario: 文档元数据格式
- **WHEN** 文档包含元数据
- **THEN** 文件顶部使用 YAML frontmatter 格式（title, date, description）

### Requirement: 开发环境 Loader 数据加载
系统 SHALL 在开发环境通过 loader 动态获取文档数据。

#### Scenario: 首页 loader 执行
- **WHEN** 开发环境用户访问首页 `/`
- **THEN** loader 执行，读取 `app/docs` 目录返回文档列表

#### Scenario: 详情页 loader 执行
- **WHEN** 开发环境用户访问文档详情页 `/docs/:slug`
- **THEN** loader 执行，读取对应文档文件返回内容

#### Scenario: 实时热更新
- **WHEN** 开发环境修改文档文件
- **THEN** 页面自动刷新显示最新内容

### Requirement: 代码块语法高亮
系统 SHALL 支持代码块的语法高亮显示。

#### Scenario: 显示高亮代码块
- **WHEN** 文档包含代码块（指定语言）
- **THEN** 系统应用 Shiki 语法高亮样式