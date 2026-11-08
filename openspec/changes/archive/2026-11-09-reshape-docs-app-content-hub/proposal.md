# Proposal

## Why

docs-app 当前以 Blog、Docs 和 Tags 组织内容，但 Tags 在 11 篇内容中产生了 52 个标签，其中 46 个只出现一次，无法承担有效导航；首页知识图谱、标签球和统一玻璃卡片也弱化了文档、文章与项目三类内容的差异。站点需要围绕 Docs、Blog、Projects 重建信息架构与界面，让读者能直接查文档、读分析文章、了解和获取 Vela 等项目。

## What Changes

- 将全站一级导航收敛为 Docs、Blog、Projects，并为桌面与移动视口提供清晰的当前分区状态。
- 重做首页为内容门户，直接展示站点定位、精选项目、Blog 最新内容和 Docs 分类入口，不再使用基于标签的 WebGL 知识图谱。
- 保留 `/blog`，增加 Blog 的“技术与工程”“股票与市场”稳定栏目，并让 Blog 正文使用 `/blog/:slug` 与独立阅读布局。
- 保留 Docs 的分类目录和正文 TOC，将列表改为适合查找的紧凑文档索引，并把 Vela 架构文章调整到 Blog。
- 新增 `/projects` 项目索引与 `/projects/vela` 专用介绍页；项目共享站点外壳，但允许使用自身品牌与页面构图。
- **BREAKING**：移除 Tags 的一级入口、标签球、标签聚合页面和可点击标签导航；`tags` 暂时作为非导航内容元数据保留。
- 为 `/docs/:slug` 中的既有 Blog 地址和 `/tags`、`/tags/:tag` 提供兼容迁移路径，避免已发布链接直接失效。
- 删除不再使用的 WebGL/Three.js 展示组件及依赖，保持 SSG 与 loader 数据模式不变。
- 将 docs-app 单独升级到 React Router v8，并同步满足其 React、Vite 与 Node 基线；其他 React Router 应用不在本次范围内。
- 功能测试与维护者 review 使用本地 dev server 和 HMR；最终交付验证 SSG 生产构建，本次 change 不执行 Cloudflare 部署。

## Capabilities

### New Capabilities

- `projects-section`: 项目索引、项目专用介绍页、Vela 内容与项目品牌边界。
- `content-url-migration`: 已发布 Blog 与 Tags URL 的兼容迁移行为。
- `docs-framework-runtime`: docs-app 的 React Router v8 框架基线、SSG 构建与本地 dev server 验收行为。

### Modified Capabilities

- `site-navigation`: 一级导航从 Blog、Docs、Tags 改为 Docs、Blog、Projects，并明确响应式和当前分区行为。
- `docs-home-layout`: 首页从知识图谱舞台调整为 Docs、Blog、Projects 内容门户。
- `blog-section`: Blog 增加稳定栏目、独立正文 URL 与对应阅读布局。
- `docs-section`: Docs 列表改为紧凑索引，并确保只承载文档内容。
- `content-model`: Blog 支持栏目，内容 URL 按类型派生；tags 降级为非导航元数据。
- `tags-system`: 移除标签列表、标签详情及标签跳转要求，仅保留 frontmatter 解析兼容。
- `docs-ssg`: 预渲染 Projects、新 Blog 正文与兼容迁移路由，不再生成标签聚合页。
- `docs-app-layouts`: 为 Blog 和 Projects 增加与内容职能匹配的布局，同时保持统一页面外壳。
- `docs-ui`: 从统一玻璃卡片和 WebGL 展示调整为可辨识的 Docs、Blog、Projects 视觉模式。
- `docs-motion-preference`: 移除分散的展示动效，并约束 Vela 连接示意的可选动效与静态降级。
- `footer-brand`: Footer 改为左侧版权年份、右侧站点品牌与描述，并移除技术栈宣传。
- `docs-full-width-layout`: 文档详情改用与 Docs 索引一致的页面骨架，并按 TOC 是否存在分配正文宽度。
- `layout-width-system`: full 模式不再绑定 WebGL 舞台或透明叠加 Header，统一使用正常站点外壳。
- `visual-design-system`: 以排版、留白和分隔线取代玻璃拟态、辉光与随机分类色。
- `home-knowledge-graph`: 退役首页 WebGL 知识图谱能力，由 Docs、Blog、Projects 内容门户取代。
- `webgl-tag-cloud`: 随 Tags 页面下线退役 3D 标签球能力。
- `tag-badge-colors`: 随公开标签展示下线退役标签随机配色能力。
- `nav-links`: 退役早期 Home/GitHub 外链规格，由 `site-navigation` 统一维护导航契约。
- `navigation-links`: 退役早期 Technical、Trading、All Tags 导航规格，由 `site-navigation` 统一维护导航契约。

## Impact

- 受影响包：`packages/apps/docs-app`；根 React patch override 同时影响 `packages/apps/react-app`、`packages/apps/i18n-studio`、`packages/libs/react-component`，并因根 workspace 路径触发 `packages/apps/vela` 验证。
- 受影响路径：`app/routes/**`、`app/components/**`、`app/lib/docs.ts`、`app/docs/**`、`app/app.css`、`public/projects/**`、`react-router.config.ts`、`vite.config.ts`、`package.json`、根 `pnpm-workspace.yaml` 与 `pnpm-lock.yaml`。
- docs-app 使用 React Router v8.5.x，并同步升级到其要求的 React 19.2.7、Vite 7+；仓库 Node 24.11+ 与 CI Node 24 已满足 React Router v8 的 Node 22.22+ 要求。经确认，根 override 将全部 React 19 workspace 消费方统一到 19.2.7，避免同一依赖图出现不兼容 peer。
- Vela 仅作为公开内容与品牌素材来源；不修改 `packages/apps/vela/**` 的产品代码、版本、协议或交付物。
- 公开路由、SSG 路径和导航结构发生变化；Cloudflare Workers 仍以 `build/client` 静态资源手动部署。
- `nodejs-ci.yml` 的 `build` job 已覆盖 `packages/**`；根 workspace 配置变更还会触发 `vela-ci.yml` 的 `verify-macos`。docs-app 仍没有单独自动化测试或部署 gate。

## Delivery Impact

- 长期文档：需要，完成后按触发表核对 `docs/4-ci-cd.md`；若部署方式和 CI 缺口未改变，只记录无需正文修改的核对结论。
- 入口文档：需要，更新 `packages/apps/docs-app/AGENTS.md` 的内容模型、公开路由与人工验收说明，使其与 Docs、Blog、Projects 一致。
- 版本：`packages/apps/docs-app` / NONE / 不更新 `package.json` 版本 / 私有应用且版本不构成交付契约；`packages/apps/react-app` / NONE / 不更新 `package.json` 版本 / 仅构建且无版本契约；`packages/apps/i18n-studio` / NONE / 不更新 `package.json` 版本 / 私有手动部署应用且版本不构成交付契约；`packages/libs/react-component` / NONE / 不更新 `package.json` 版本 / 私有且不发布；`packages/apps/vela` / NONE / 不更新任何 Vela 版本来源 / Vela 源码与交付物未变，根 workspace 路径仅触发既有 Vela CI。
- 发布：不需要，本次交付止于本地 dev server review 与最终构建验证，不执行 `pnpm -F docs-app deploy`。
- 验收：需要，以 `pnpm -F docs-app dev` 持续运行功能测试与维护者 review，检查新旧 URL、桌面/移动导航、键盘操作和减少动态效果；最终运行 `pnpm -F docs-app typecheck`、`pnpm -F docs-app build` 验证类型与 SSG 产物。
