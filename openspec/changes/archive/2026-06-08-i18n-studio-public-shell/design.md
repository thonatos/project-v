# Design — i18n-studio Public Shell

## 0. 整体路由分割

```
                              ┌──────────────┐
GET /                         │   PUBLIC     │ ← landing(匿名)
GET /docs/**                  │   SHELL      │ ← MDX 文档站(匿名)
GET /docs/openapi.json        │              │ ← OpenAPI 资源(匿名)
GET /login, /register         │              │
                              └──────────────┘

                              ┌──────────────┐
GET/POST /dashboard           │  DASHBOARD   │ ← namespace 列表
GET/POST /dashboard/new       │   SHELL      │ ← 新建 namespace
GET/POST /dashboard/:slug/**  │ (requireUser)│ ← 现有 ns 全部子页
GET/POST /dashboard/locales   │              │ ← locale 字典管理
                              └──────────────┘

                              ┌──────────────┐
GET/POST /api/**              │   API        │ ← 不变
GET      /snapshot/:slug/**   │   (不变)     │ ← 不变
                              └──────────────┘
```

**两套 shell**:`AppShellHeader` 现有逻辑能容纳两种,通过传 `user={null}` 表达匿名状态。landing 多一个 hero/features 模块,但 header / theme toggle / cmd palette 复用同一组组件。

## A. Landing 页 `/`

### A.1 路由与 loader

```
app/routes/_index.tsx          ← landing(匿名,不再 requireUser)
```

```ts
export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);     // 不强制
  const user = userId ? findUser(userId) : null;
  const theme = getTheme(request);
  return { user, theme };
}
```

### A.2 模块布局

```
┌──────────────────────────────────────────────────────────────┐
│  AppShellHeader  brand · Docs · GitHub      [Sign in / 进入后台 / ⌘K · ☼ · Avatar▾]
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   HERO                                                       │
│   ─────                                                      │
│   把多语言词条管理变成 Pull Request 一样的工作流              │
│                                                              │
│   i18n-studio 把"草稿 → 发布 → 历史"建模成跨命名空间的协作流  │
│   程,自带翻译任务、Snapshot 缓存通道与 OpenAPI 文档站。      │
│                                                              │
│   [ Sign in ]   [ 阅读文档 ↗ ]                               │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│   FEATURES (3-col grid; mobile single col)                   │
│   ┌───────┐ ┌───────┐ ┌───────┐                              │
│   │ 草稿/  │ │ 跨空间 │ │ 任务化 │                              │
│   │ 发布   │ │ 同步   │ │ 协作   │                              │
│   └───────┘ └───────┘ └───────┘                              │
│   ┌───────┐ ┌───────┐ ┌───────┐                              │
│   │Snapshot│ │ Locale│ │ 单文件 │                              │
│   │ 通道   │ │ 字典   │ │ 部署   │                              │
│   └───────┘ └───────┘ └───────┘                              │
├──────────────────────────────────────────────────────────────┤
│   FOOTER  © 2026 i18n-studio · Docs · OpenAPI · GitHub        │
└──────────────────────────────────────────────────────────────┘
```

`Hero` / `Features` / `Footer` 都是 landing 内部组件,放在 `app/components/landing/`,不污染 `ui/` 与 `shadcn` 命名空间。

### A.3 已登录访客的 `/`

不强制跳转。只在 header 把 `Sign in` 替换为「进入后台」按钮指向 `/dashboard`,Hero CTA 主按钮也从 `Sign in` 变成「进入后台」。

### A.4 SEO

- `<title>i18n-studio · 多语言词条管理工作流</title>`
- `<meta name="description">` 一行
- 不加 sitemap / robots.txt(本次范围外,与 docs 一致)

## B. 后台搬迁到 `/dashboard/**`

### B.1 文件改名表

```
app/routes/_index.tsx                         landing  (重写,匿名)
app/routes/dashboard.tsx                      NEW: 受保护 layout
app/routes/dashboard._index.tsx              ← 原 _index.tsx 内容(namespace 列表)
app/routes/dashboard.new.tsx                 ← ns.new.tsx
app/routes/dashboard.locales.tsx             ← locales.tsx
app/routes/dashboard.$slug.tsx               ← ns.$slug.tsx
app/routes/dashboard.$slug._index.tsx        ← ns.$slug._index.tsx
app/routes/dashboard.$slug.entries._index.tsx        ← ns.$slug.entries._index.tsx
app/routes/dashboard.$slug.entries.$key._index.tsx   ← ns.$slug.entries.$key._index.tsx
app/routes/dashboard.$slug.entries.$key.history.tsx  ← ns.$slug.entries.$key.history.tsx
app/routes/dashboard.$slug.members.tsx       ← ns.$slug.members.tsx
app/routes/dashboard.$slug.settings.tsx      ← ns.$slug.settings.tsx
app/routes/dashboard.$slug.sync.tsx          ← ns.$slug.sync.tsx
app/routes/dashboard.$slug.tasks.tsx         ← ns.$slug.tasks.tsx
```

`api.*` / `snapshot.*` 不动。

### B.2 受保护的 layout

```ts
// app/routes/dashboard.tsx
import { Outlet } from 'react-router';
import { requireUser } from '~/lib/auth.server';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const theme = getTheme(request);
  return { user, theme };
}

export default function DashboardLayout() {
  return <Outlet />;
}
```

`AppShellHeader` 依然由各个子路由按需挂载(因为它们对面包屑/leadingSlot 各不相同),但 `requireUser` 只在 layout 调用一次。子路由 loader 仅做权限检查与数据加载,不再各自调 `requireUser`。

### B.3 全站链接更新

涉及的文件(以下全部把字符串中的 `/ns/` 替换成 `/dashboard/`,`/locales` 替换成 `/dashboard/locales`):

```
app/components/command-palette.tsx
app/components/app-shell.tsx
app/components/locale-multi-select.tsx
app/lib/services/namespace.server.ts        ← 错误信息中的"系统语言字典为空,请先在 /locales 中添加 locale"
app/lib/auth.server.ts                       ← loginAndCreateSession 默认 redirectTo
app/scripts/repair-locales.ts                ← 升级提示
app/routes/_index.tsx (landing) — 不需要,landing 不应该往 /dashboard 硬链
app/routes/login.tsx, register.tsx, logout.tsx
app/routes/dashboard.*.tsx (改名后内部硬链)
```

不更新的字符串:specs / openspec 文档(由 i18n-entry-management 的 MODIFIED 部分单独同步)。

## C. Markdown 内容管线(unified + prerender)

vite.config.ts **不再注册** MDX 插件。所有 markdown 在 build 期由 `app/lib/docs.ts` 中的 unified pipeline 处理:

```ts
// app/lib/docs.ts(节选)
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

const docsDir = path.join(process.cwd(), 'app/docs');

export interface Doc {
  slug: string;
  title: string;
  description: string;
  content: string; // 编译后的 HTML 字符串
  toc: TocItem[];
}

export async function getDocBySlug(slug: string): Promise<Doc | null> { ... }
export async function getDocSlugs(): Promise<string[]> { ... }
export async function getDocsInOrder(): Promise<Doc[]> { ... } // 按 ['index','guide','api','deployment','changelog']
```

frontmatter 仅识别 `title` / `description`(无 `date` / `tags`)。代码高亮由 `rehype-highlight` 在 build 期生成 `hljs-*` class,客户端无运行时高亮引擎。

`react-router.config.ts` 的 `prerender()` 调 `getDocSlugs()` 动态生成 build 期 prerender 路径列表:

```ts
async prerender() {
  const slugs = await getDocSlugs();
  return ['/docs', ...slugs.filter((s) => s !== 'index').map((s) => `/docs/${s}`)];
}
```

`tsconfig.json` 不再需要 `*.mdx` 模块声明(`app/types/mdx.d.ts` 已删除)。

## D. 文档路由结构

```
app/routes/
  docs.tsx                ← layout,sidebar + Outlet,匿名;loader 调 getDocsInOrder() 取 sidebar 数据
  docs._index.tsx         ← /docs (loader 调 getDocBySlug('index'))
  docs.$slug.tsx          ← /docs/:slug,处理 guide / api / deployment / changelog 全部页

app/docs/
  index.md
  guide.md
  api.md
  deployment.md
  changelog.md

app/components/docs/
  docs-sidebar.tsx        ← 接受 SidebarItem[] props,使用 NavLink 渲染

app/lib/
  docs.ts                 ← unified pipeline 与 fs 读取
```

每个 markdown 顶部带 frontmatter:

```md
---
title: 综合指南
description: 从注册到第一条词条 publish 的端到端流程
---

# 综合指南
...
```

路由组件直接将 loader 返回的 `content` HTML 字符串注入 React DOM(已在 build 期编译,内容是仓库内可信源,无运行时用户输入);sidebar 由 layout 直接读 markdown 文件目录,`/docs` 对应 `slug='index'`。

不再有 `app/docs/registry.ts` 与 `app/docs/components/`(自渲染 OpenAPI 组件不再需要,API 详情转由 `/openapi.json` 提供)。

## E. OpenAPI 暴露

API 接口的"唯一真相"是 `public/openapi.json`(由前置 change 移到此处),通过 vite/react-router 的 public/ 静态资源直接对外暴露 — `GET /openapi.json` 返回该文件。

文档站不再在页面内自渲染每个 endpoint;`/docs/api` 仅介绍鉴权、错误格式、路径前缀与 OpenAPI tag 分组,详细字段引用 `/openapi.json`。Postman / Bruno / Insomnia 等工具直接导入 `/openapi.json` 即可获得完整请求集合。

> **决策**:本次手写 openapi.json,不接入 zod → openapi codegen。约 30 个 operation,可控。后续若需引入 codegen,仍以该文件为产出目标。

## F. `/openapi.json` 静态资源

`public/openapi.json` 由 vite/react-router 的 public/ 静态资源管线直接对外暴露,无需自定义 loader:

```
GET /openapi.json → public/openapi.json (Content-Type: application/json)
```

文档站内可提供下载入口:`<a href="/openapi.json" download>`。`vite.config.ts` 同时通过 `~openapi` alias(`path.resolve(__dirname, 'public/openapi.json')`)允许测试与脚本静态读取该文件。

## G. 全局导航接入

```
LANDING header (匿名 / 已登录两态):
  ┌────────────────────────────────────────────────┐
  │ [logo] i18n-studio    Features  Docs  GitHub   │
  │                              [Sign in / 进入后台] [⌘K] [☼]
  └────────────────────────────────────────────────┘

DASHBOARD header (现有):
  ┌────────────────────────────────────────────────┐
  │ [logo] i18n-studio  /  Namespaces  /  …       │
  │       [Docs ↗]                                  │
  │                          [⌘K] [☼] [Avatar▾]    │
  └────────────────────────────────────────────────┘

DOCS layout header:
  沿用 AppShellHeader,brand 链接指 /,匿名也能见。

CommandPalette:
  Theme
  System (superuser only)
  Help            ← 新增
    Open docs
```

匿名访问 `/login` / `/register` / 404 也能见 Docs 与 Home 链接。

## H. 内容编写约定

每个 `.md` 顶部带 frontmatter:

```md
---
title: 综合指南
description: 一句话描述,作为 meta description 与 sidebar 副本
---

# 综合指南

> 适用对象:管理员

i18n-studio 把词条管理建模成"草稿 → 已发布 → 历史"...

## 词条工作流

...

> **提示**:bundle_version 在每次"成功 publish"时 +1。
```

转换规则:
- 旧 mdx 中的 `<Callout type="info|tip|warning">` → markdown blockquote `> **提示**:` / `> **警告**:`
- 旧 `<Endpoint operationId="..." />` → 删除,改为 inline prose 描述对应 method/path,详细字段引用 `/openapi.json`
- 旧 `<ParamTable>` / `<ResponseExample>` / `<ErrorTable>` → 删除或改为 markdown 表格 / 代码块
- 旧 `<HttpBadge method="POST" />` → inline code `POST`
- 内部链接保留标准 markdown:`[text](/docs/xxx)` / `[text](#锚点)`(GFM 自动 slug)

文档反映**当前已实施的 spec 状态**(modernization + locale-management + 本次 public-shell 落地后的现状),链接示例统一用 `/dashboard/...`、`/openapi.json`。

## I. 风险与缓解

| 风险 | 缓解 |
| ---- | ---- |
| 文件改名引发 git 历史断裂 | 用 `git mv`,git 自动追踪 rename;PR 描述里点名说明改名 |
| 已登录用户访问 `/` 期望直接进入后台 | header CTA 显示"进入后台",一键跳转;不强制 redirect 是为了让营销页 demo 可见 |
| unified pipeline 影响 SSR 启动 | 仅在 build 期(server bundle import 时)与 prerender 阶段执行,运行时已是静态 HTML |
| `process.cwd()` 在 build 期未指向 i18n-studio 包目录 | `pnpm -F i18n-studio build` 将 cwd 设为该包目录,与 docs-app 同款方案;实测 prerender 5 个路由均成功 |
| openapi.json 与代码漂移 | tasks 列出"修改 API 必同步 docs"约定;后续 change 增加同步 task |
| 旧 `/docs/openapi.json` 链接破坏 | 该路径在 public-shell 上线时还未对外发布;新链接 `/openapi.json`,changelog 中说明 |
| landing 已登录用户看到 `Sign in` 困惑 | header / hero CTA 都依据 `user` 状态切换文案 |

## J. 不在本次范围

- **交互式 Token tester**(用户已明确不做)
- **贡献者文档**(放 README / openspec/)
- **Schema codegen**(zod / drizzle → openapi)
- **多语言文档**(中文唯一)
- **全文搜索**(留待后续)
- **PDF 导出 / API playground**
- **Landing 上的产品截图 / 动效 / 视频**(首版只用文本卡片,避免引入图片资源管理负担)
- **`/api/...` 路径迁移**(对外行为契约,**不改**)
- **自渲染 OpenAPI 组件**(本次 public-shell 重构后不再提供;详见 `/openapi.json` + 第三方导入器)
