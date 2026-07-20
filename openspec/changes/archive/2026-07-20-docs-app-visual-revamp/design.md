## Context

docs-app 是基于 React Router v7（SSR）+ Tailwind v4 的静态内容站点，部署在 Cloudflare Workers，从文件系统读取 markdown 渲染。当前视觉以文字/线条为主，单一紫色仅用于描边和文字，卡片是白底+边框，"标签云"只是按频次分档字号。站点定位为"现代化设计 + 技术展示"，展示占比 > 50%。

本设计将站点重塑为 dark-first 沉浸式展示台：统一深色视觉体系、真 WebGL 交互、差异化布局宽度，同时保证内容页可读性、SEO/无障碍与 Cloudflare/SSR 约束下的稳健降级。

**约束：**
- Cloudflare Workers + SSR：three/R3F 为纯客户端库，必须 client-only 挂载并 code-split，不进 SSR/首屏 bundle。
- SEO/无障碍：canvas 内文字不可被爬虫/读屏识别，标签与导航语义必须保留在 DOM。
- 性能：R3F 生态 gzip 后约 150–200KB，需懒加载；低端设备/无 WebGL/`prefers-reduced-motion` 需降级。
- 项目规范：不引入 Jotai（docs-app 走 loader/action）；UI 沿用现有 Tailwind + 少量组件；`node:` 前缀；`interface` 定义结构。

## Goals / Non-Goals

**Goals：**
- 建立一套贯穿全站的 dark-first 设计语言（tokens + 卡片 + 代码高亮 + 动效曲线）。
- 用真 WebGL 效果承载"展示"定位：3D 标签球、首页知识网络图谱 + 滚动叙事。
- 三级布局宽度（full-bleed / contained / reading），文章可按需切换宽度。
- 差异化但风格统一的列表页（Blog 杂志卡 / Docs 色彩矩阵）。
- 完整降级：无 WebGL / reduced-motion / SSR 时回落语义化 DOM。

**Non-Goals：**
- 不引入亮色/暗色切换开关（本次 dark-first 单主题；亮色 token 仅保留注释以备回滚）。
- 不改动 markdown 内容处理管线（remark/rehype 管线除新增 frontmatter 字段外不动）。
- 不引入外部状态库（Jotai 等），3D 状态在组件内局部管理。
- 不做多语言、评论、搜索等新功能。

## Decisions

### D1：dark-first 分层深色，而非全站死黑，也不做亮/暗切换

用由深到浅的表面层叠出纵深：`bg-base #0a0a0f` / `surface-1 #13131a` / `surface-2 #1c1c26` / `glass rgba(255,255,255,0.04)+backdrop-blur`。主色 violet `#8264ff`→fuchsia `#d946ef` 渐变在暗底上"发光"。

- 备选：亮/暗切换。放弃，因为 WebGL 辉光/粒子在暗底效果好一个量级，双主题会使 3D 配色与代码高亮复杂度翻倍，与"展示优先"目标不匹配。保留亮色 token 注释块以支持整体回滚。

### D2：布局宽度分级 + PageShell 参数化

将 `BasicLayout` 演进为 `PageShell`，接受 `width: 'full' | 'contained' | 'reading'`：
- `full`：100vw 无边距，WebGL 舞台；内层再包一个 contained 容器承载可读文字。
- `contained`：`max-w-7xl` 居中，列表/常规页。
- `reading`：`max-w-3xl` 居中，文章正文最佳行宽。

Header 在 `full` 模式渲染为透明玻璃浮层，滚动后渐变实心（滚动位置阈值切换 class）。文章宽度由 frontmatter `layout: reading | wide` 决定（默认 reading）。

- 备选：每页各自写宽度类。放弃，易漂移、难统一。

### D3：3D 用 @react-three/fiber 生态，而非裸 three.js

选 `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing`：声明式组件、内置 raycaster 交互（onClick/onPointerOver）、`<Bloom>` 一行辉光、drei 提供 `<Text>`/`<Billboard>`/`<OrbitControls>`。与 React/loader 数据天然融合。

- 备选：裸 three.js（手动场景/渲染循环/raycaster，工作量大、与 React 状态难同步）；CSS 3D（无法做 Bloom/粒子/景深，达不到"真 WebGL 炫技"）。

### D4：client-only 懒加载 + 语义降级双轨

3D 组件用 `React.lazy` + 动态 `import()`，仅在客户端、且通过 WebGL 能力检测与 `prefers-reduced-motion` 检查后挂载。SSR 与降级时渲染真实 DOM：
- 标签页：SSR 输出隐藏/可见的 `<a href="/tags/xxx">` 列表（复用现有 2D TagCloud 作为 fallback），3D 就绪后覆盖其上或替换。
- 首页：SSR 输出 hero 文字 + 分区入口的静态 DOM，WebGL 图谱作为背景增强层。

这样爬虫/读屏/无 WebGL 用户始终拿到可用内容与可点链接。

### D5：分类色彩编码

将 `tag-colors.ts` 扩展/新增为 category→稳定色的映射（violet/cyan/amber/emerald/rose/indigo 6 色），按分类名哈希稳定分配。Docs 列表用其做色块矩阵与左边条，标签详情页用该标签色贯穿。

### D6：暗色代码渲染

代码块底色下沉到 `#0d1117` + 1px 微亮边框 + 轻内阴影形成"凹陷"；重调 hljs 语法色为高对比暗色主题（借鉴 GitHub Dark / One Dark）；inline code 改半透明主色底 `rgba(130,100,255,0.15)`；mermaid 保留深色并统一边框到新 token。

### D7：首页知识网络数据

复用 `getAllDocs()`：节点 = 文章（按分类着色）+ 标签；边 = 同一文章内标签共现，以及文章→其标签。共现矩阵在 loader（服务端）计算并序列化传给客户端，3D 侧只做布局与渲染。

## 关键流程

### 标签页 3D 加载与降级（时序）

```
浏览器          Route(SSR)      ClientOnly gate    lazy(TagCloud3D)
  │  GET /tags    │                 │                  │
  │──────────────▶│ loader:getAllTags                  │
  │  HTML(含2D <a>列表 fallback)     │                  │
  │◀──────────────│                 │                  │
  │ hydrate       │                 │                  │
  │───────────────────────────────▶│ 检测 WebGL / reduced-motion
  │                                 │  ├─ 不支持 → 保留 2D fallback，结束
  │                                 │  └─ 支持 → import() 动态加载
  │                                 │──────────────────▶│ 挂载 R3F canvas
  │                                 │                    │ 渲染 3D 球 + Bloom
  │  拖拽/hover/点击 ───────────────────────────────────▶│ 旋转/高亮/router.navigate
```

### 首页滚动叙事

```
scroll 事件 ──▶ 更新滚动进度 p(0..1)
                 ├─▶ R3F useFrame: 相机位置/朝向按 p 插值穿行图谱
                 └─▶ IntersectionObserver: Blog/Docs/Tags 分区依次淡入(DOM)
reduced-motion ──▶ 停用相机动画与淡入，静态展示
```

## Risks / Trade-offs

- [首屏 bundle 被 three 拖垮] → client-only 懒加载 + code-split，three 不进 entry chunk；hero 首屏为纯 DOM，WebGL 异步补充。
- [Cloudflare Workers SSR 引入浏览器 API 报错] → 3D 代码严格 client-only，`typeof window` / useEffect gate，绝不在 loader/模块顶层触碰 three。
- [WebGL 文字无法被 SEO/读屏识别] → 语义 DOM 始终存在（D4），canvas 设 `aria-hidden`。
- [低端移动设备卡顿/耗电] → 移动端降低粒子数/关闭 Bloom 或直接回落 2D；尊重 `prefers-reduced-motion`。
- [暗色化后代码块糊进背景] → 代码块下沉色 + 微亮边框 + 内阴影（D6）。
- [知识图谱节点过多性能差] → 边数上限/聚类，必要时抽稀标签节点。

## Migration Plan

单一 PR 落地，内部按模块推进并逐块自验（typecheck + build）：
1. 设计系统 tokens + 暗色 + 代码高亮（app.css）。
2. PageShell 宽度体系 + Header 浮层 + docs.ts frontmatter `layout`。
3. 通用组件（卡片/footer/tag-chip/category 色彩编码）。
4. 列表页（Blog 杂志卡 / Docs 色彩矩阵）+ 文章详情暗色化与双宽度。
5. 3D 标签球（含降级）。
6. 首页知识网络 + 滚动叙事（含降级）。
7. 性能/a11y 兜底、bundle 分割核验。

**回滚**：保留亮色 token 注释块可整体切回；3D 为独立懒加载模块，可通过降级路径关闭；新增依赖仅 client-only 使用；frontmatter `layout` 可选，回滚后旧文档正常解析；整体可 git revert。

## Open Questions

- 移动端 3D 的具体降级阈值（粒子数/是否关 Bloom）待实测调优。
- 知识图谱边数上限的具体数值待数据规模确定后微调。
