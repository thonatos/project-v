## ADDED Requirements

### Requirement: 公开首页

i18n-studio SHALL 在路径 `/` 提供匿名可访问的产品介绍首页,且 loader MUST NOT 调用 `requireUser`、MUST NOT 因为未登录而重定向到 `/login`。

#### Scenario: 匿名访客可见 landing

- **GIVEN** 未登录的访客
- **WHEN** 访问 `/`
- **THEN** 返回 200,渲染 landing 页面(包含 header / hero / features / footer 四个模块);**不**重定向到 `/login`

#### Scenario: 已登录用户的 landing CTA 切换

- **GIVEN** 已登录用户
- **WHEN** 访问 `/`
- **THEN** 仍渲染 landing 页面;header 与 hero 中的主 CTA 文案 SHALL 切换为"进入后台",链接指向 `/dashboard`(而非 `Sign in` → `/login`)

#### Scenario: 主要模块齐全

- **GIVEN** 任意访客访问 `/`
- **WHEN** 检查 DOM
- **THEN** 至少存在以下结构:页面顶部的 `header`(含品牌、`Docs` 入口与登录区域)、含产品口号与至少一组 CTA 的 `hero` 区、不少于 3 张特性卡片组成的 `features` 区、含版权与 `Docs` 链接的 `footer`

### Requirement: 后台路由前缀 `/dashboard`

所有需要登录的命名空间管理与系统级 locale 字典管理页 SHALL 挂载在路径前缀 `/dashboard` 下,且 SHALL 通过受保护的 layout 路由集中调用 `requireUser`。

#### Scenario: 后台路径覆盖

- **GIVEN** 部署运行中的 i18n-studio
- **WHEN** 列出生效路由
- **THEN** 至少存在以下登录强制的路由:
  - `/dashboard`(原 `/`,namespace 列表)
  - `/dashboard/new`(原 `/ns/new`)
  - `/dashboard/:slug` 与其全部子路由(原 `/ns/:slug` 与子路由)
  - `/dashboard/locales`(原 `/locales`)

#### Scenario: 受保护 layout 强制登录

- **GIVEN** 未登录访客
- **WHEN** 访问 `/dashboard` 或其任意子路径
- **THEN** layout loader 抛出重定向到 `/login`,响应状态为 302

#### Scenario: 后台子页面不重复 requireUser

- **GIVEN** `/dashboard/**` 范围内的任何子路由源文件
- **WHEN** 检查 loader / action 实现
- **THEN** 它们 MUST NOT 各自调用 `requireUser`(由 layout 统一负责);子路由仅做权限细化(如 admin-only)与数据加载

#### Scenario: 登录成功跳转后台

- **GIVEN** 用户提交合法的登录表单
- **WHEN** 服务端处理 `POST /login`
- **THEN** 返回 302 重定向到 `/dashboard`(而不是 `/`);注册成功 (`POST /register`) 同样跳转 `/dashboard`

### Requirement: 内置文档站

i18n-studio SHALL 提供一个内置的文档站,挂载于路由前缀 `/docs`,作为系统使用说明与 API 接口说明的统一入口。

#### Scenario: 路由树存在

- **GIVEN** 部署运行中的 i18n-studio
- **WHEN** 列出生效路由
- **THEN** 至少存在以下路由:
  - `/docs`(总览)
  - `/docs/guide`(综合使用指南)
  - `/docs/api`(API 参考)
  - `/docs/deployment`(部署)
  - `/docs/changelog`(更新日志)
  - `/openapi.json`(OpenAPI 静态资源,由 `public/openapi.json` 直接提供)

#### Scenario: docs 与现有路由不冲突

- **GIVEN** 现有路由(`/`、`/login`、`/dashboard/...`、`/api/...`、`/snapshot/...`)
- **WHEN** 引入 `/docs/...` 路由
- **THEN** 既有路由的 loader / action / meta 行为均不受影响

### Requirement: 匿名可访问

`/docs/**` 与 `/openapi.json` SHALL 不依赖登录会话,任意未认证访客 MUST 能完整查看文档内容,且 loader 不得调用 `requireUser`。

#### Scenario: 匿名访问总览

- **GIVEN** 未登录的访客
- **WHEN** 访问 `/docs`
- **THEN** 返回 200,渲染总览页,不发生重定向到 `/login`

#### Scenario: 匿名访问 API 参考

- **GIVEN** 未登录的访客
- **WHEN** 访问 `/docs/api`
- **THEN** 返回 200,渲染对应内容

#### Scenario: 匿名访问 openapi.json

- **GIVEN** 未登录的访客
- **WHEN** 访问 `GET /openapi.json`
- **THEN** 返回 200,Content-Type 为 `application/json`,body 是合法 OpenAPI 3.x 文档

### Requirement: Markdown 内容管线

文档内容 SHALL 以 `.md` 文件存放于 `app/docs/**`,通过 unified / remark / rehype 在构建期编译为 HTML 字符串,经 loader 透传给路由组件渲染;文档路由 SHALL 走 react-router 的 `prerender` 在 build 期生成静态 HTML,运行时不做 markdown 解析。

#### Scenario: 内容来源是 .md

- **GIVEN** 任意一个文档页(例如 `/docs/guide`)
- **WHEN** 检查文件源
- **THEN** 该页面的内容由 `app/docs/guide.md` 通过 `getDocBySlug` 在 build 期读取,经 unified pipeline 编译

#### Scenario: 不引入运行时 markdown 解析

- **GIVEN** 客户端 bundle
- **WHEN** 检查依赖
- **THEN** 不包含 `marked` / `markdown-it` / `@mdx-js/runtime` 等运行时解析库;unified / remark / rehype 仅在 build 期(server bundle + prerender)运行

#### Scenario: 代码高亮在 build 期完成

- **GIVEN** 任意一个含代码块的文档页
- **WHEN** 查看 prerender 输出 HTML
- **THEN** 代码块已被 `rehype-highlight` 处理并带 `hljs-*` class,客户端不再加载高亮引擎

### Requirement: 文档站布局与导航

文档站 SHALL 提供统一布局,包含 header(沿用 `AppShellHeader`)、左侧 sidebar(列出所有文档 + 当前页高亮)、右侧主内容区。sidebar 数据 SHALL 由 docs layout loader 通过 `getDocsInOrder()` 从 `app/docs/*.md` 文件枚举得出,顺序为:总览(index)、综合指南(guide)、API 参考(api)、部署(deployment)、更新日志(changelog)。

#### Scenario: sidebar 高亮当前页

- **GIVEN** 用户访问 `/docs/api`
- **WHEN** 页面渲染完成
- **THEN** sidebar 中"API 参考"项视觉上处于选中态

#### Scenario: 桌面端两列布局

- **GIVEN** 视口宽度 ≥ 1024px
- **WHEN** 加载 `/docs/...` 任意子路由
- **THEN** 同时可见 sidebar(左)与主内容区(右)

#### Scenario: 移动端 sidebar 折叠

- **GIVEN** 视口宽度 < 768px
- **WHEN** 加载 `/docs/...`
- **THEN** sidebar 默认隐藏,header 中提供菜单触发器,点击后以 `Sheet` 形式展开;Sheet 内呈现与桌面端一致的导航项

### Requirement: 全局导航入口

i18n-studio 的全局 shell SHALL 在以下位置提供 `Docs` 入口,且对匿名用户也可见:

1. landing(`/`) header 与 hero / footer
2. dashboard(`/dashboard/**`) header 中
3. docs(`/docs/**`) header 中
4. 命令面板的 "Help" 分组中的 "Open docs"
5. 移动端 Sheet(无论位于 landing 还是 dashboard)

#### Scenario: 匿名访问任意公共页可见 Docs 入口

- **GIVEN** 未登录访客访问 `/`、`/login`、`/register` 任意页面
- **WHEN** 视口宽度 ≥ 768px
- **THEN** header 中可见 `Docs` 链接,点击跳转 `/docs`

#### Scenario: 命令面板含 Help 分组

- **GIVEN** 用户在任意页面打开命令面板(已登录或匿名,只要命令面板被挂载)
- **WHEN** 列出分组
- **THEN** 至少存在一个 "Help" 分组,内含 "Open docs",选中后跳转 `/docs`

### Requirement: OpenAPI 数据真相文件

i18n-studio SHALL 在 `public/openapi.json` 维护一份完整的 OpenAPI 3.x 文档,覆盖所有现存的 `app/routes/api.*` 与 `app/routes/snapshot.*` 资源路由,且 SHALL 通过 `GET /openapi.json` 路由对外暴露(由 vite/react-router 的 public/ 静态资源直接提供,无需自定义 loader)。

#### Scenario: 覆盖完整

- **GIVEN** `app/routes/` 中所有 `api.*` 与 `snapshot.*` 文件
- **WHEN** 把它们映射成 HTTP 方法 + path
- **THEN** 每个映射结果都能在 `openapi.json` 的 `paths` 中找到对应 operation,且每个 operation 至少含 `operationId`、`tags`、`summary`、`description`、`security`、`responses`

#### Scenario: openapi.json 可被外部工具消费

- **GIVEN** Postman / Bruno / Insomnia 之类的 OpenAPI 导入器
- **WHEN** 用 `https://<host>/openapi.json` 作为导入源
- **THEN** 工具能识别为合法 OpenAPI 3.x 文档,生成对应请求集合

### Requirement: 文档内容范围

文档站 SHALL 覆盖以下用户向页面,**SHALL NOT** 包含贡献者文档(架构图、测试组织、OpenSpec 流程等):

| 路径 | 角色 | 内容 |
| ---- | ---- | ---- |
| `/docs` | 全部 | 总览 + 角色导航 |
| `/docs/guide` | 管理员 / 集成方 / worker / superuser | 综合使用指南(快速开始 + 词条工作流 + 翻译任务 + 跨空间同步 + Snapshot 消费 + Locale 字典) |
| `/docs/api` | 集成方 / worker / 管理员 | API 鉴权、错误格式、路径前缀、资源分组,详细 endpoint 字段引用 `/openapi.json` |
| `/docs/deployment` | 运维 | Docker / 环境变量 / 升级流程 |
| `/docs/changelog` | 全部 | 已发布 change 摘要 |

#### Scenario: 全部页面渲染成功

- **GIVEN** 上表中每个路由
- **WHEN** 加载该路由
- **THEN** 返回 200 且 main 区不为空(初版至少包含一段实质性介绍文本与对应 API/UI 的引用)

#### Scenario: 不含贡献者文档

- **GIVEN** `app/docs/**/*.md`
- **WHEN** 列出文件名
- **THEN** 不含 `contributing` / `architecture` / `testing-strategy` / `openspec-workflow` 之类的贡献者向页面;贡献者文档若有,SHALL 留在 `README.md` / `openspec/` / `CONTRIBUTING.md`

### Requirement: openapi.json 静态资源

`/openapi.json` SHALL 作为 vite/react-router 的 public/ 静态资源直接对外暴露,Content-Type 为 `application/json`,无需登录即可访问。

#### Scenario: 返回有效 JSON

- **GIVEN** 任意访客
- **WHEN** `GET /openapi.json`
- **THEN** 状态 200,Content-Type 包含 `application/json`,body 可被 `JSON.parse` 解析为合法 OpenAPI 3.x 文档
