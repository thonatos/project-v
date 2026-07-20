## 1. 设计系统 tokens 与暗色主题

- [x] 1.1 在 app.css 定义分层深色 tokens（bg-base / surface-1 / surface-2 / glass）与文字色，替换 body 亮色背景，保留亮色 token 注释块以备回滚
- [x] 1.2 定义 violet→fuchsia 主色渐变、辉光/柔和阴影、统一圆角与动效缓动 token
- [x] 1.3 重做暗色 prose 基础样式（标题/正文/链接/引用/表格/hr）适配深色

## 2. 暗色代码渲染

- [x] 2.1 代码块底色下沉 + 微亮边框 + 轻内阴影，形成凹陷层次
- [x] 2.2 重调 hljs 语法高亮为高对比暗色主题
- [x] 2.3 inline code 改为半透明主色底 + 主色文字
- [x] 2.4 调整 mermaid 深色渲染与容器边框，统一到新 token

## 3. 布局宽度体系

- [x] 3.1 将 BasicLayout 演进为 PageShell，支持 width: full | contained | reading
- [x] 3.2 Header 支持 full 模式透明玻璃浮层 + 滚动阈值切实心
- [x] 3.3 在 docs.ts 的 DocFrontmatter/Doc 与 normalizeFrontmatter 增加可选 layout 字段（默认 reading），保证旧文档兼容

## 4. 通用组件与色彩编码

- [x] 4.1 将 tag-colors.ts 扩展为分类色彩编码（6 色稳定哈希映射 category）
- [x] 4.2 改造 SummaryLinkCard / ArticleCard 为玻璃拟态卡片 + 分类色左边条 + 悬停辉光
- [x] 4.3 更新 tag-chip、footer 适配暗色体系

## 5. 列表页与文章详情

- [x] 5.1 Blog 列表重构为杂志式色块卡片
- [x] 5.2 Docs 列表重构为分类色彩编码矩阵
- [x] 5.3 标签详情页 tags.$tag 用该标签主题色贯穿
- [x] 5.4 文章详情 docs.$slug 暗色化，按 frontmatter layout 选择 reading/wide 宽度

## 6. 3D 标签云（webgl-tag-cloud）

- [x] 6.1 添加依赖 three / @react-three/fiber / @react-three/drei / @react-three/postprocessing
- [x] 6.2 实现 WebGL 能力检测与 prefers-reduced-motion 检测工具
- [x] 6.3 实现球面（Fibonacci）分布 + Billboard 文字 + count 映射字号/辉光的 3D 标签球组件
- [x] 6.4 加入 Bloom 后处理、惯性拖拽旋转、自动慢转、hover 高亮、点击 router 导航
- [x] 6.5 client-only 懒加载封装；tags._index SSR 输出 2D 语义链接列表作为 fallback，无 WebGL/reduced-motion 回落 2D

## 7. 首页知识网络（home-knowledge-graph）

- [x] 7.1 在 _index loader 基于 getAllDocs 计算标签共现矩阵与节点/边数据并序列化
- [x] 7.2 实现 WebGL 知识网络图谱组件（文章/标签节点、共现边、按分类着色）
- [x] 7.3 实现滚动叙事：相机随滚动进度穿行 + IntersectionObserver 分区淡入
- [x] 7.4 client-only 懒加载 + 静态首页 DOM 降级（SSR/无 WebGL/reduced-motion）

## 8. 兜底、性能与验收

- [x] 8.1 核验 three/R3F 独立 code-split，不进首屏入口 bundle
- [x] 8.2 校验 reduced-motion 与无 WebGL 全路径降级可用
- [x] 8.3 pnpm -F docs-app typecheck 通过
- [x] 8.4 pnpm -F docs-app build 通过，并本地核验各页面视觉与交互
- [x] 8.5 openspec validate docs-app-visual-revamp --strict 通过
