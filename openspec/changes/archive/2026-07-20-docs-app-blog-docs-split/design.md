## Context

docs-app 是基于 React Router v7 的纯静态站点（`ssr: false` + 构建期 `prerender`），部署在 Cloudflare。内容为 `app/docs/*.md`，构建期由 `app/lib/docs.ts` 用 unified（remark→rehype）转成 HTML 字符串，运行时注入到文章容器，mermaid 在客户端 `mermaid.run()` 渲染。

当前 frontmatter 由手写正则解析（`docs.ts:41-78`），仅支持单行 `key: value` 与简单数组。样式已全量使用 `var(--color-*)` 抽象（紫色单主题）。现有 10 篇内容天然分为投资分析（blog）与技术教程（docs）两类，但站点无类型概念，首页扁平平铺。

约束：保持纯静态、保持 14px 字号、本轮不做暗色。

## Goals / Non-Goals

**Goals:**
- 引入显式内容分类模型（`type` / `category`），数据层可按类型/分类派生。
- Blog 走时间流，Docs 走左侧分类树，落地页做双分区聚合。
- 用成熟库替换脆弱的手写 frontmatter 解析。
- 复用现有组件（ArticleCard、TOC、mobile drawer 模式），最小化新增。

**Non-Goals:**
- 暗色主题、全文搜索、RSS、OG image、字号变更。
- 引入 SSR 或动态数据源。
- 内容文件迁移（`.md` 仍留在 `app/docs/`，靠 frontmatter 区分类型，不改物理路径与 slug）。

## Decisions

### 决策 1：内容类型来源 = frontmatter 显式字段

新增 `type: blog | docs`（必填）与 `category: <string>`（仅 docs）。

- **为何**：显式、每篇自声明、不动文件路径与 slug、扩展性好（未来 `series`/`draft`/`featured` 同处扩展）。
- **备选**：目录约定（需移动文件、改 slug/prerender 路径）；靠 tags 推断（规则脆弱、语义耦合）。均劣于显式字段。
- **缺省与容错**：缺 `type` 时默认按 `blog` 处理并在构建日志告警（避免漏标导致内容消失）；`docs` 缺 `category` 时归入 `Uncategorized`。

### 决策 2：用 gray-matter 替换手写解析器

- **为何**：现有正则不支持多行/嵌套/完整 YAML；加 `category` 与更多字段会越来越别扭。gray-matter 是社区标准、零配置、构建期使用无运行时负担。
- **影响**：`extractFrontmatter` 删除，`getDocBySlug` 改用 `matter(content)`；`Doc` 接口新增 `type`、`category`。
- **备选**：从 `remark-frontmatter` 的 yaml AST 节点取值——可行但仍需自己解析 YAML；gray-matter 更直接。

### 决策 3：Docs 分类维度 = frontmatter `category`（粗粒度），tags 保留作细粒度

现有 tags 太细碎（linux/ssh/pve…），不适合做分类树。分类树用 `category` 两层结构（category → 文章），tags 继续服务 `/tags` 检索。初始 4 类：

| category | 归属文章 |
|---|---|
| System & Server | ubuntu-server-setup、make-a-bootable-usb-from-an-iso |
| Network & Proxy | network-proxy-setup |
| Virtualization | setup-pve-and-routeros |
| Tools & Tutorials | tradingview-tutorial-2023 |

### 决策 4：布局复用现有骨架

- `/docs/:slug` 三栏 = 左侧分类树 + `minmax(0,1fr)` 正文 + 200px TOC。基于现有 `doc-layout.tsx` 的 grid 扩展一列。
- `/docs` 列表页同为「左侧分类树 + 右侧分组卡片」，与文章页骨架一致，导航连贯（用户选项 1）。
- 移动端分类树复用现有 mobile TOC drawer 的抽屉模式（`toc.tsx`），不新造交互范式。
- `/blog` 直接复用 `ArticleCard` 的 `variant="list"`。

### 决策 5：数据派生 API

在 `docs.ts` 增加：
- `getDocsByType(type)`：按类型过滤（已 sort by date）。
- `getDocCategories()`：返回 `{ category, docs[] }[]`，供分类树与 Docs 列表/落地页复用。
- 落地页用 `getDocsByType('blog').slice(0, N)` + `getDocCategories()`。

## 数据流

```
构建期 prerender
   │
   ├─ getDocSlugs() ── 读 app/docs/*.md
   │
   ├─ getDocBySlug(slug)
   │     └─ gray-matter 解析 → { type, category, title, date, tags, ... }
   │     └─ unified 处理 body → HTML + toc
   │
   ├─ 派生：getDocsByType('blog')  → /blog、落地页 Blog 分区
   │        getDocsByType('docs')  ┐
   │        getDocCategories()     ┘→ /docs、/docs/:slug 分类树、落地页 Docs 分区
   │
   └─ prerender 路由: / /blog /docs /docs/:slug /tags /tags/:tag
```

## Risks / Trade-offs

- **漏标 `type` 导致内容不出现** → 缺省按 `blog` 处理 + 构建告警；本次给全部 10 篇显式补齐。
- **三栏布局在中等屏幕（md）拥挤** → 分类树仅 `lg` 及以上显示，`md` 及以下收入抽屉，与 TOC 断点策略一致。
- **新增依赖 gray-matter** → 成熟稳定、仅构建期使用，风险低；锁定精确版本。
- **prerender 列表遗漏新路由** → 在 `react-router.config.ts` 显式补 `/blog`、`/docs`，并在 tasks 中验证产物。

## Migration Plan

1. 加 `gray-matter` 依赖，改造 `docs.ts`（解析器 + 类型 + 派生函数），保持既有导出兼容。
2. 给 10 篇 `.md` 补 `type`/`category`。
3. 新增分类树组件与 `/blog`、`/docs` 路由，改造 `/docs/:slug` 与 `/`、Header。
4. 更新 prerender 列表，`pnpm -F docs-app build` 验证所有路由产物齐全、无渲染回归。

**回滚**：本次改动集中在 docs-app，且不改文件路径/slug。回滚 = 还原 `docs.ts`、路由与组件、`.md` frontmatter（`type`/`category` 为增量字段，移除不影响正文），并移除 `gray-matter` 依赖。无数据迁移、无外部副作用。

## Open Questions

- 落地页 Blog 分区预览条数 N（建议 5）——实现时定，非阻塞。
- 分类树是否显示每类文章数徽标——建议显示（复用 tag count 视觉），非阻塞。
