## Why

当前 docs-app 以文字和线条为主，缺乏色块、层次与视觉焦点，信息密度低、页面间视觉差异小，整体感观偏平。站点定位是"现代化设计 + 技术展示"，但现有"标签云"只是按频次分档的字号排版，并非真正的可交互效果，未能体现其技术展示的定位。本次改造将站点重塑为 **dark-first 的沉浸式技术展示台**：以真 WebGL 效果、分层深色视觉体系和差异化布局承载"展示优先（占比 > 50%）"的目标，同时保留内容页的可读性。

## What Changes

- **BREAKING**：全站默认视觉主题由亮色改为分层深色（dark-first），配套重做设计 tokens、卡片、代码高亮与 mermaid 渲染。
- 引入统一设计语言：violet→fuchsia 主色渐变、6 色分类色彩编码、玻璃拟态卡片、统一圆角/阴影/辉光/动效曲线。
- 引入三级布局宽度体系（full-bleed / contained / reading），并将 `BasicLayout` 参数化为 `PageShell`；Header 在沉浸页支持透明玻璃浮层。
- 文章页支持通过 frontmatter `layout: reading | wide` 按需切换定宽阅读或宽版布局。
- 列表页差异化重构：Blog 走杂志式色块卡片，Docs 走分类色彩编码矩阵。
- 标签页替换为**真 3D WebGL 标签球**（@react-three/fiber + drei + postprocessing Bloom），支持惯性旋转、hover 高亮、点击路由。
- 首页重构为**全宽知识网络图谱 + 滚动叙事**：将文章/标签/分类抽象为节点，标签共现为边，相机随滚动穿行。
- 全站兜底：WebGL 能力检测、`prefers-reduced-motion` 与 SSR 降级到语义化 DOM，3D 相关代码 client-only 懒加载并做 bundle 分割。

## Capabilities

### New Capabilities

- `visual-design-system`：分层深色 tokens、主色渐变、分类色彩编码、玻璃拟态卡片、统一圆角/阴影/辉光/动效曲线等全站视觉基础。
- `layout-width-system`：full-bleed / contained / reading 三级宽度体系，PageShell 容器、透明浮层 Header、文章 frontmatter `layout` 开关。
- `dark-code-rendering`：暗色环境下的代码块、inline code、语法高亮（hljs 重调）与 mermaid 图渲染方案。
- `webgl-tag-cloud`：真 3D 可交互标签球（球面分布、Bloom 辉光、旋转/hover/点击、降级路径）。
- `home-knowledge-graph`：首页全宽知识网络图谱（共现数据计算、WebGL 渲染、滚动叙事、降级路径）。

### Modified Capabilities

<!-- openspec/specs/ 下暂无既有 capability spec，本次全部为新建，无既有需求变更。 -->

## Impact

- **代码**：`app/app.css`（tokens/暗色/代码高亮全面重做）、`app/components/*`（basic-layout→PageShell、header、footer、article-card、summary-link-card、tag-cloud、tag-chip、mermaid-*、code-block）、`app/routes/*`（_index、blog._index、docs._index、tags._index、tags.$tag、docs.$slug）、`app/lib/docs.ts`（新增 frontmatter `layout` 字段、知识图谱共现数据）、`app/lib/tag-colors.ts`（扩展为分类色彩编码）。
- **依赖**：新增 `three`、`@react-three/fiber`、`@react-three/drei`、`@react-three/postprocessing`（全部 client-only 懒加载，code-split 不进 SSR/首屏 bundle）。
- **系统/部署**：Cloudflare Workers + React Router v7 SSR；3D 组件必须 client-only 挂载，SSR 输出降级 DOM。需关注首屏 bundle 体积与 WebGL/低端设备/reduced-motion 降级。
- **内容**：markdown frontmatter 新增可选 `layout` 字段，不影响现有文档（默认 reading）。

## Rollback Plan

- 视觉体系与暗色主题集中在 `app/app.css` 的 tokens 与少量组件类名，保留原亮色 token 注释块（现已存在），必要时可整体切回亮色。
- 3D 能力为独立懒加载模块，出问题可通过特性开关/降级路径回落到 2D 标签云与静态首页（降级路径本就是交付的一部分）。
- 新增依赖仅供 client-only 模块使用，移除依赖不影响 SSR 内容渲染。
- 变更以单一 PR 落地并保留 git 历史，可整体 revert；frontmatter `layout` 为可选字段，回滚后旧文档仍可正常解析。
