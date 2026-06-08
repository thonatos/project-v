## Why

i18n-studio 当前没有「公共门面」:

1. 访问 `/` 直接被 `requireUser` 顶到 `/login`,首次访问者看不到这是个什么系统、能做什么、技术栈是什么
2. 没有内置使用说明 / API 文档,集成方拿到 token 也只能读源码;26 个 API 路由全靠口口相传
3. 管理后台路由(`/ns/*`、`/locales`)与未来可能的公开内容(landing、docs)挤在同一根路径下,语义不清晰 — 一个 `/` 同时承担"产品介绍"与"我加入了哪些 namespace"两个完全不同的视角

我们要把根路径切成两半:

- **公共区**:`/`(landing)、`/docs/**`、`/login`、`/register` — 匿名可访问,有自己的 marketing-friendly 视觉
- **管理后台**:`/dashboard/**`,登录强制的全部既有功能

## What Changes

### A. 公开首页 `/`(landing)

- **匿名可访问**;`requireUser` 退出 `/`
- 自上而下:
  - **Header**:logo + 主导航(Features / Docs / GitHub) + Sign in / Sign up;桌面端 inline,移动端 Sheet
  - **Hero**:产品口号(中文) + 一段 sub-headline + 双 CTA(`Sign in` 主、`阅读文档` 次)
  - **Features**:3-6 张特性卡片(草稿/发布/历史 · 跨空间同步 · 任务化协作 · Snapshot 通道 · 系统级 locale 字典 · 单文件 SQLite 部署)
  - **(可选)技术栈与部署**:简短一行,SQLite + React Router v7 + 单容器
  - **Footer**:版权 + 文档链接 + GitHub
- 已登录访问 `/` 仍渲染 landing(不强制跳转后台);header 右侧把 `Sign in` 替换为"进入后台"按钮指向 `/dashboard`
- 视觉沿用 shadcn + Tailwind,与后台同主题(同一份 dark mode cookie)

### B. 管理后台搬迁到 `/dashboard/**`

| 旧路径 | 新路径 |
| ---- | ---- |
| `/` (namespace 列表) | `/dashboard` |
| `/ns/new` | `/dashboard/new` |
| `/ns/:slug` | `/dashboard/:slug` |
| `/ns/:slug/entries` 等所有子页 | `/dashboard/:slug/entries` 等 |
| `/locales` | `/dashboard/locales` |

- 文件级 `git mv`:`app/routes/_index.tsx` → `app/routes/dashboard._index.tsx`,`ns.$slug.*.tsx` → `dashboard.$slug.*.tsx`,`locales.tsx` → `dashboard.locales.tsx`
- 引入 `app/routes/dashboard.tsx` 作为受保护的 layout 路由,集中调 `requireUser` + 渲染 `<AppShellHeader>` + `<Outlet />`,后台页面不再各自 `requireUser`
- `/login` 与 `/register` 的成功跳转目标改为 `/dashboard`(而非 `/`)
- **不保留旧路径兼容**:`/ns/*` 与 `/locales` 直接 404,残留链接由调用方自行更新
- 内部链接、命令面板、面包屑、错误信息文案中的 `/ns/...` / `/locales` 全部更新指向 `/dashboard/...`

### C. 内置文档站 `/docs/**`(unified pipeline + prerender)

- 路由 `app/routes/docs.tsx` / `docs._index.tsx` / `docs.$slug.tsx` + 文档源 `app/docs/*.md`(纯 markdown + frontmatter)
- 内容管线:`unified` + `remark-parse` + `remark-gfm` + `remark-frontmatter` + `remark-rehype` + `rehype-highlight` + `rehype-stringify`,在 build 期把 `.md` 编译为 HTML 字符串,经 loader 透传给路由组件渲染
- `react-router.config.ts` 的 `prerender()` 调 `getDocSlugs()` 动态生成 `/docs` / `/docs/guide` / `/docs/api` / `/docs/deployment` / `/docs/changelog`,build 期产出静态 HTML
- layout `docs.tsx` 提供 sidebar + 主内容区,**匿名可访问**;sidebar 数据来自 layout loader 调 `getDocsInOrder()`
- 不再使用 mdx-js / 自渲染 OpenAPI 组件 / `app/docs/registry.ts`;不再有 `<Endpoint>` / `<ParamTable>` 等 React 组件嵌入文档

### D. OpenAPI 数据真相

- `public/openapi.json`(由前置 change 移到 `public/`)直接作为静态资源由 vite/react-router 提供,通过 `GET /openapi.json` 暴露
- 文档不再用自渲染组件展示每个 endpoint 的细节;`/docs/api` 仅介绍鉴权、错误格式与路径分组,详细 endpoint 参考 `/openapi.json`
- 不引入 swagger-ui / redoc

### E. 文档内容(用户向)

精简为 5 篇 markdown,覆盖四类用户:管理员 / 集成方 / 翻译 worker / 运维。明确**不**含贡献者文档(架构图、测试组织、OpenSpec 流程)。

```
index.md       — 总览 + 角色导航
guide.md       — 综合使用指南(快速开始 + 词条工作流 + 翻译任务 + 跨空间同步 + Snapshot 消费 + Locale 字典)
api.md         — API 鉴权、错误格式、路径前缀、tags 分组(详细字段引用 /openapi.json)
deployment.md  — Docker / 环境变量 / 升级流程
changelog.md   — openspec archive 摘录
```

### F. 全局导航接入

- 桌面 header(landing 与 dashboard 两个 shell 都有):brand 与右侧操作区之间的 Docs 链接;landing 上还多一个 `Sign in`/"进入后台"
- 移动端:landing 用 Sheet 抽屉(同样的 nav 结构);dashboard 沿用现有 `AppShellHeader` 的 leadingSlot Sheet,末尾追加 Docs
- 命令面板 `app/components/command-palette.tsx`:新增 "Help" 分组,含 "Open docs"
- 匿名访问 `/login` / `/register` / 404 同样能看到 Docs 与 Home 链接

## Capabilities

### New Capabilities

- `i18n-studio-public-shell`:landing 首页 + 内置文档站(unified/remark/rehype + 静态 prerender) + `/dashboard/**` 后台路由空间 + 统一导航入口

### Modified Capabilities

- `i18n-entry-management`:**仅**为同步路由前缀,把 spec 中"用户打开 `/ns/B/sync`"的描述更新为 `/dashboard/B/sync`(语义不变,行为契约不变)。其他 `/api/...` / `/snapshot/...` 路径完全不变。

## Impact

- **依赖新增**(dependencies):`unified`、`remark-parse`、`remark-gfm`、`remark-frontmatter`、`remark-rehype`、`rehype-highlight`、`rehype-stringify`、`unist-util-visit`;devDependencies:`@types/mdast`、`@types/hast`
- **依赖移除**:`@mdx-js/react`、`@mdx-js/rollup`、`@types/mdx`、`rehype-pretty-code`、`shiki`、`rehype-slug`、`rehype-autolink-headings`
- **构建**:vite 不再需要 MDX 插件;`.md` 在 build 期由 unified pipeline 编译为 HTML 字符串,react-router `prerender()` 在 build 期生成 5 个静态 HTML 文件
- **bundle**:仅渲染时输出 prerender 出来的 HTML 字符串;客户端不带 markdown 解析器或代码高亮引擎
- **路由总数**:新增 1 个 landing + 3 个 docs 路由(layout / `_index` / `$slug`)+ ~12 个 dashboard 子路由(均由旧 `/ns/*` / `/locales` 改名而来)
- **行为契约**:词条 / 翻译 / 任务 / 同步 / 快照 / 权限矩阵的对外行为不变;`/api/...` / `/snapshot/...` 路径**完全不变**(避免破坏外部集成)
- **链接破坏面**:`/ns/...` / `/locales` 旧链接直接 404,需要调用方自行更新到 `/dashboard/...`;`/docs/openapi.json` 旧链接 → `/openapi.json`
- **文档同步**:本次把 docs 内容写到反映"迁移后"的状态(链接示例都用 `/dashboard/...`);后续 spec 修改时文档同步是相应 change 的责任
- **回滚计划**:仅新增路由 + 改名(`git mv`)。出问题可整体 revert
