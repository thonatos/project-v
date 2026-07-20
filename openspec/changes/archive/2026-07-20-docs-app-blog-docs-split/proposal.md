## Why

docs-app 目前是一个扁平的静态文档站：首页把所有文章以卡片网格平铺，所有内容一视同仁。但实际内容天然分为两类——**投资分析报告**（有日期序列、时效性强，像博客）与**技术 setup 教程**（常青、查阅型，像文档）。缺少内容类型区分、缺少 Docs 的分类导航，站点既不像现代博客也不像现代文档站。本次改造引入内容分类模型，把站点重构为 **Blog + Docs 双栏并存**的现代化文档/博客站点。

## What Changes

- 引入 frontmatter 内容分类模型：新增 `type`（`blog` | `docs`，必填）与 `category`（仅 `docs` 使用）字段。
- 用 `gray-matter` 替换 `app/lib/docs.ts` 中手写的正则 frontmatter 解析器，支持完整 YAML 语法。
- 新增 `/blog` 路由：Blog 时间流列表，按日期倒序，复用现有 `ArticleCard` 的 list 变体。
- 新增 `/docs` 路由：左侧分类树 + 右侧按 `category` 分组的卡片列表。
- 新增 `/docs/:slug` 的三栏布局：左侧分类树 + 正文 + 右侧 TOC（TOC 已就绪）。
- 落地页 `/` 改为双分区预览：Blog 分区（最近若干篇）+ Docs 分区（按分类概览）。
- Header 导航新增 Blog / Docs 入口。
- 给现有 10 篇文档补齐 `type`/`category` frontmatter（5 篇 blog、5 篇 docs，docs 归入 4 个分类）。
- **BREAKING**：`/docs/:slug` 页面布局由两栏变为三栏（新增左侧分类树），移动端分类树收入抽屉。

不在本次范围（Non-Goals）：暗色主题（CSS 变量已就位，后续独立 change）、全文搜索、RSS、字号调整（保持 14px）。

## Capabilities

### New Capabilities

- `content-model`：内容分类数据模型——frontmatter `type`/`category` schema、gray-matter 解析、按类型/分类派生数据的 lib 接口。
- `blog-section`：Blog 区——`/blog` 时间流列表与落地页 Blog 分区预览。
- `docs-section`：Docs 区——`/docs` 列表页、`/docs/:slug` 文章页的左侧分类树布局，及落地页 Docs 分区预览。
- `site-navigation`：站点导航——Header 的 Blog / Docs / Tags 入口与落地页双分区聚合。

### Modified Capabilities

<!-- openspec/specs/ 下暂无既有 spec，本次均为新增能力，无既有需求变更 -->

## Impact

- 受影响代码（`packages/apps/docs-app/`）：
  - `app/lib/docs.ts`（解析器替换、新增 type/category 与派生函数）
  - `app/routes.ts` 及新增路由文件 `blog._index.tsx`、`docs._index.tsx`（`docs.$slug.tsx` 已存在，需改布局）
  - `app/routes/_index.tsx`（落地页改双分区）
  - `app/components/`：新增分类树组件；`header.tsx`、`doc-layout.tsx` 调整
  - `app/docs/*.md`：10 篇补 frontmatter
  - `react-router.config.ts`：prerender 列表新增 `/blog`、`/docs`
- 依赖：新增 `gray-matter`。
- 数据/构建：仍为纯静态（`ssr: false` + prerender），不引入 SSR。
