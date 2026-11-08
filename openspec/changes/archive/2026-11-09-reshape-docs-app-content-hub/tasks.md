# Tasks

## 1. React Router v8 基线

- [x] 1.1 将 docs-app 的 `react-router`、`@react-router/dev`、`@react-router/node`、`@react-router/serve`、`@react-router/fs-routes` 统一升级到 v8.5.x，将 Vite 升到 7.x，并按维护者确认把根 React/React DOM patch override 从 19.2.5 统一升到 19.2.7；通过定向 pnpm 更新生成根 `pnpm-lock.yaml`，用 `pnpm -F docs-app list --depth 0` 验证实际版本，用安装输出、`pnpm install --frozen-lockfile` 和 `pnpm peers check --filter docs-app` 验证无 engine/peer 错误，并检查其他应用的 `package.json` 未被修改。
- [x] 1.2 按官方 v8 迁移要求更新 docs-app 中废弃的 route meta `data` 用法、框架配置和 Vite 配置，移除只为 Three.js 存在的 dedupe/optimize 配置；运行 `pnpm -F docs-app typecheck`，确认 v8 typegen 与 TypeScript 退出码为 0。
- [x] 1.3 在保持现有页面行为的中间状态运行 `pnpm -F docs-app build`，确认 `ssr: false` 构建退出码为 0 且 `packages/apps/docs-app/build/client` 生成，先隔离框架升级问题再进入信息架构改造。

## 2. 内容模型与规范 URL

- [x] 2.1 扩展 `app/lib/docs.ts`，为 Blog 定义 `engineering`、`markets` 稳定栏目、显示文案、栏目筛选与按类型派生的规范 `href`；通过 `pnpm -F docs-app typecheck` 验证非法类型和调用点，并通过一次构建验证缺失或无效 Blog 栏目会报告可定位文件的错误。
- [x] 2.2 更新 `app/docs/*.md` frontmatter：Vela 架构文章迁移为 Blog / engineering，股票与投资分析归入 Blog / markets，全部既有 Blog 补齐有效栏目；运行一个只读 frontmatter 清单命令，验证每篇 Blog 都恰有允许的栏目且 Docs 分类保持原值。
- [x] 2.3 新增 `/blog/:slug` 正文 route 和不含 Docs 分类树的 Blog 阅读布局，统一首页、Blog 列表与正文中的内容链接；运行 `pnpm -F docs-app build`，检查每篇 Blog 的 `build/client/blog/<slug>/index.html` 存在，且 Blog 页面显示栏目、日期、正文和可用 TOC。
- [x] 2.4 将历史 `/docs/:slug` 中的 Blog 请求改为带后备链接和 hydration 后 replace 的静态迁移页，Docs 请求继续原地渲染；运行 `pnpm -F docs-app build`，在静态产物中检查历史 Blog 与现有 Docs 路径均存在，并在本地预览中直接访问各一条路径验证迁移与原地阅读行为。

## 3. 统一外壳、首页、Docs 与 Blog UI

- [x] 3.1 重构全局视觉 token、排版、Header 和 Footer：桌面端提供 Docs、Blog、Projects、GitHub 一行导航，移动端使用品牌行加三入口导航行，并为当前分区设置 `aria-current`、文字/线条状态和清晰键盘焦点；用本地页面在 375px 与 1280px 视口检查无溢出，并用键盘依次聚焦全部入口。
- [x] 3.2 将首页改造成紧凑内容门户，首屏说明技术文档、分析文章和项目定位，展示精选 Vela、最新 Blog 与 Docs 分类，删除全屏图谱和滚动提示；运行 `pnpm -F docs-app build` 并检查预渲染首页在禁用 JavaScript时仍显示三类内容及规范链接。
- [x] 3.3 将 `/docs` 改为“分类目录 + 紧凑文档索引”，保持 Docs 详情的“分类目录 + 正文 + TOC”职责，并把日期表达为最近更新；在桌面视口检查三栏与无 TOC 文档，在移动视口检查分类目录和 TOC 入口可见、Escape 可关闭且焦点回到触发控件。
- [x] 3.4 将 `/blog` 改为编辑式时间流，提供“全部 / 技术与工程 / 股票与市场”栏目筛选，显示标题、摘要、日期和栏目而不显示标签导航；逐一切换栏目，验证结果集合、排序、当前状态和空状态均可理解且不只依赖颜色。
- [x] 3.5 更新 `packages/apps/docs-app/AGENTS.md` 的内容模型、公开路由和人工验收说明，核对文档中的脚本名均存在于 docs-app `package.json`，并运行 `git diff --check` 验证文档格式无尾随空白。

## 4. Projects 与 Vela 项目页

- [x] 4.1 新增轻量项目注册表和 `/projects` 索引，登记 Vela 的名称、摘要、Active 状态、macOS/iOS 平台与详情地址；在 375px 与 1280px 视口验证单列/宽屏布局、状态文字和全部操作可见且可聚焦。
- [x] 4.2 将 Vela 双帆标志复制为 docs-app 自有静态资产并记录来源，新增 `/projects/vela` 专页，覆盖用途、Mac/iPhone 职责、工作方式、安全边界、macOS 14+/Apple Silicon 要求、GitHub Releases、使用说明、技术文章和源码入口；人工逐项核对页面事实与 `packages/apps/vela/README.md`、`docs/release.md` 一致，且页面没有 App Store/TestFlight 或硬编码版本承诺。
- [x] 4.3 为 Vela 页面实现局部暖棕品牌 token 与静态可读的 Mac-to-iPhone 航线，动画仅作轻量增强；在正常模式和 `prefers-reduced-motion: reduce` 下检查信息与操作完全一致，减少动态效果时航线保持静态可理解。
- [x] 4.4 更新 SSG 路径并运行 `pnpm -F docs-app build`，确认 `build/client/projects/index.html` 与 `build/client/projects/vela/index.html` 存在，随后直接访问两个本地预览 URL 验证无需站内导航也能加载。

## 5. Tags 与 WebGL 下线

- [x] 5.1 将 `/tags` 与构建时已知的 `/tags/:tag` 改为前往 `/blog` 的静态迁移页，移除 Header、首页、卡片和正文中的 Tags 入口，但继续解析 `tags` frontmatter；在禁用 JavaScript时检查迁移页有明确后备链接，在启用 JavaScript时验证使用 replace 到 `/blog`。
- [x] 5.2 删除标签聚合、标签球、知识图谱及 WebGL 专用组件和 hook，确认代码中不再引用对应模块；用 `rg 'HeroGraph|TagCloud|KnowledgeGraph|useWebGL|getDocsByTag|getAllTags' packages/apps/docs-app/app` 验证只保留迁移确需的兼容读取入口或无匹配，并检查首页、Docs、Blog、Projects 的空状态不依赖这些组件。
- [x] 5.3 从 docs-app 移除 `three`、`@react-three/fiber`、`@react-three/drei`、`@react-three/postprocessing` 等无剩余引用依赖并更新 lockfile；用 `pnpm -F docs-app list --depth 0` 验证这些直接依赖消失，运行 `pnpm -F docs-app typecheck` 与 `pnpm -F docs-app build` 验证退出码均为 0。

## 6. 集成、交付与本地 Review

- [x] 6.1 运行 `openspec validate reshape-docs-app-content-hub --strict`、`pnpm -F docs-app typecheck`、`pnpm -F docs-app build`，逐项确认退出码为 0；检查静态产物包含首页、全部 Docs、全部 Blog、Projects/Vela 和已知历史兼容路径。docs-app 没有自动化测试，路由、响应式和可访问性行为使用本组人工浏览器证据补足，不新增与仓库测试策略不一致的源码扫描测试。
- [x] 6.2 按 `docs/4-ci-cd.md` 运行受影响路径的本地门 `pnpm check`、`pnpm test`、`pnpm -r --filter '!vela' build` 和因根 `pnpm-workspace.yaml` 触发的 `pnpm -F vela verify`，记录 `nodejs-ci.yml` 的 `build` 与 `vela-ci.yml` 的 `verify-macos` 映射；部署 gate 仍是既有缺口，本次因不部署不新增 workflow。
- [x] 6.3 在桌面 1280px、移动 375px 和 reduced-motion 三种条件下检查首页、Docs 索引/正文、Blog 索引/正文、Projects/Vela、旧 Blog URL、`/tags` 与一个 `/tags/:tag`；记录无水平溢出、键盘焦点可见、当前导航明确、抽屉可关闭、无控制台错误和迁移目标正确。
- [x] 6.4 核对维护触发表与 Delivery Impact：`docs/4-ci-cd.md` 的 CI/部署事实未变则记录无需正文更新；分别确认 `docs-app`、`react-app`、`i18n-studio`、`react-component` 与 `vela` 均为 NONE 并不更新版本来源，理由与 proposal 一致；本次不 tag、不执行 `pnpm -F docs-app deploy`。
- [x] 6.5 使用 `pnpm -F docs-app dev` 持续运行支持 HMR 的本地服务，确认终端输出本地地址且关键 URL 返回成功；通过该服务完成维护者 review，最终另行运行 typecheck 与生产构建，不执行任何外部部署。

## Workflow follow-up

- 维护者完成本地 review 后，根据反馈继续修改并重新执行受影响验证。
- 维护者明确接受且 change 满足完成定义后，再单独执行 OpenSpec 归档流程。
- Cloudflare 部署不属于本次 change；只有维护者以后明确提出部署请求时才进入独立部署动作。
