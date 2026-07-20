## 1. 数据模型与解析（content-model）

- [x] 1.1 添加 `gray-matter` 依赖到 `packages/apps/docs-app/package.json`（锁定精确版本）
- [x] 1.2 在 `app/lib/docs.ts` 用 `gray-matter` 替换手写 `extractFrontmatter`，`getDocBySlug` 改用 `matter()`
- [x] 1.3 `Doc` / `DocFrontmatter` 接口新增 `type: 'blog' | 'docs'` 与可选 `category`
- [x] 1.4 实现 `type` 缺省容错（缺省按 `blog` + 构建告警）与 docs `category` 缺省 `Uncategorized`
- [x] 1.5 新增 `getDocsByType(type)` 与 `getDocCategories()` 派生函数（按日期倒序 / 按分类分组）

## 2. 内容 frontmatter 补齐

- [x] 2.1 5 篇 blog 补 `type: blog`：tsla-full-analysis-2026-07、tsla-full-analysis-2026-05、tsla-investment-analysis-2026-05、intc-investment-analysis-2026-05、insta360-investment-analysis-2026-05-08
- [x] 2.2 5 篇 docs 补 `type: docs` + `category`：ubuntu-server-setup / make-a-bootable-usb-from-an-iso（System & Server）、network-proxy-setup（Network & Proxy）、setup-pve-and-routeros（Virtualization）、tradingview-tutorial-2023（Tools & Tutorials）

## 3. Blog 区（blog-section）

- [x] 3.1 新增 `app/routes/blog._index.tsx`：loader 取 `getDocsByType('blog')`，复用 `ArticleCard` list 变体，含空状态
- [x] 3.2 验证 blog 文章经 `/docs/:slug` 正常渲染正文与 TOC（沿用现有管线）

## 4. Docs 区（docs-section）

- [x] 4.1 新增分类树组件（桌面常驻 + 高亮当前文章），数据源 `getDocCategories()`
- [x] 4.2 分类树移动端抽屉：复用 `toc.tsx` 的 drawer 交互模式
- [x] 4.3 新增 `app/routes/docs._index.tsx`：左侧分类树 + 右侧按分类分组卡片，含空状态
- [x] 4.4 改造 `app/components/doc-layout.tsx`：docs 文章为三栏（分类树 + 正文 + TOC），blog 保持无分类树；处理 TOC 为空时不错位
- [x] 4.5 `app/routes/docs.$slug.tsx` 按 `type` 选择布局（docs 三栏 / blog 两栏）

## 5. 导航与落地页（site-navigation）

- [x] 5.1 `app/components/header.tsx` 新增 Blog / Docs 入口（桌面常驻 + 移动端适配）
- [x] 5.2 改造 `app/routes/_index.tsx`：Blog 分区（最近 N 篇 + 查看全部）+ Docs 分区（按分类概览 + 查看全部）
- [x] 5.3 `react-router.config.ts` prerender 列表新增 `/blog`、`/docs`

## 6. 验证

- [x] 6.1 `pnpm -F docs-app typecheck` 通过
- [x] 6.2 `pnpm -F docs-app build` 成功，确认 `/`、`/blog`、`/docs`、各 `/docs/:slug`、`/tags`、`/tags/:tag` 产物齐全
- [x] 6.3 本地 `start` 抽查：落地页双分区、Blog 时间流、Docs 分类树（桌面/移动）、文章三栏、mermaid 与代码高亮无回归
- [x] 6.4 `pnpm lint` 通过

## 7. 视觉重构（首页 / Tags）

- [x] 7.1 `ArticleCard` 新增 `compact` 变体（日期 + 标题 + 单行摘要）
- [x] 7.2 首页加克制 hero + Blog 改紧凑时间流 + Docs 分类卡显示文章标题预览 + section 标题加分隔线
- [x] 7.3 新增 `TagCloud` 组件（字号/权重随文章数分级），`/tags` 列表页改用标签云
- [x] 7.4 `/tags/:tag` 详情页精简：标题合并为 `# tag · N 篇`、相关标签 inline、去除套盒面板
- [x] 7.5 清理孤儿组件：删除 `tag-summary-card`、`tag-filter-panel`、`article-list-panel`、`content-panel`
- [x] 7.6 重新 build + lint + 浏览器验收（首页 / Tags 列表 / Tag 详情）
