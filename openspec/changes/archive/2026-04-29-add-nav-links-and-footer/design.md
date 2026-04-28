## Context

docs-app 是一个基于 React Router v7、React 19、Tailwind CSS 和 shadcn/ui 的单页应用。当前导航栏可能已存在内部路由链接，但缺少指向外部资源的快捷入口。Footer 区域可能存在但未包含技术栈品牌信息。

本次变更需要扩展现有组件，而非引入新的架构模式或依赖。

## Goals / Non-Goals

**Goals:**

- 在导航栏添加 Home 和 GitHub 外部链接，支持点击跳转
- 在 Footer 添加项目描述 "undefined project." 展示项目信息
- 在 Footer 添加 "Powered By React Router" 品牌标识
- 保持现有 UI/UX 风格一致性，使用 Tailwind CSS 和 shadcn/ui 风格
- 确保链接可访问性（键盘导航、屏幕阅读器友好）

**Non-Goals:**

- 不重构导航栏或 Footer 的整体架构
- 不添加新的外部依赖库
- 不修改现有内部路由逻辑
- 不实现链接的动态配置（如从配置文件读取）

## Decisions

### 决策 1：外部链接使用原生 `<a>` 标签而非 React Router `<Link>`

**理由**: React Router 的 `<Link>` 组件专为内部路由设计，外部链接应使用原生 `<a>` 标签以确保正确的浏览器行为（新标签页打开、 noreferrer 安全属性等）。

**替代方案**: 使用 `<Link to="https://...">` - 会导致路由器尝试处理外部 URL，造成不必要的复杂性。

### 决策 2：使用 Lucide React 图标库的 Home 和 GitHub 图标

**理由**: 项目已集成 shadcn/ui，shadcn/ui 默认使用 Lucide React 图标库，保持一致性。Home 和 GitHub 图标是标准 UI 模式，用户认知度高。

**替代方案**: 使用其他图标库（如 Heroicons） - 会引入额外依赖，增加包体积。

### 决策 3：GitHub 链接仅使用图标，不显示文字

**理由**: GitHub 图标是业界标准视觉符号，用户认知度高，纯图标设计简洁且不占用额外空间。Home 链接使用文字+图标组合，因为 "Home" 含义更通用，文字能更明确传达功能。

**替代方案**: GitHub 链接使用文字+图标 - 会增加导航栏宽度，视觉冗余，文字 "GitHub" 不必要且国际化成本高。

### 决策 4：Footer 品牌标识使用文字链接而非图片 logo

**理由**: React Router 的官方 logo 图片需要额外资源文件，文字链接更轻量且维护成本低。用户可通过链接访问 React Router 官网获取更多信息。

**替代方案**: 使用 React Router logo 图片 - 增加资源管理复杂性，且本项目不是 React Router 官方项目。

### 决策 5：Footer 布局采用项目描述（左）+ 技术栈品牌（右）结构

**理由**: 项目描述展示项目身份，放置在左侧或居中位置符合用户视觉扫描习惯（从左到右）。技术栈品牌标识作为补充信息，放置在右侧或底部，形成 Footer 的标准双栏布局。

**替代方案**: 所有信息单行居中排列 - 当 Footer 内容较多时会导致行过长，响应式适配困难。

### 决策 6：主题风格从 slate 变为 neutral

**理由**: neutral 色系（gray 600-700 范围）提供更中性、更专业的视觉基调，适合技术类项目。slate 色系带有轻微蓝调，neutral 更接近纯灰色，兼容性更广。Tailwind CSS 的 neutral 色板与 shadcn/ui 默认配色体系一致。

**替代方案**: 保持 slate 色系 - 蓝调可能在某些场景下与其他 UI 元素产生色彩冲突，且不如 neutral 通用。

**影响范围**: 所有使用 slate 色系的 Tailwind CSS 类名（如 `bg-slate-*`, `text-slate-*`, `border-slate-*`）需替换为 neutral 对应值。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 外部链接可能被用户误认为是内部链接 | 使用图标视觉区分（外部链接图标）+ aria-label 属性说明 |
| GitHub 链接指向错误仓库 | 配置时使用环境变量或常量存储正确 URL，避免硬编码多处重复 |
| Footer 品牌文字可能与 React Router 官方风格不符 | 使用 "Powered By React Router" 标准表述，链接指向官方站点 |

## Migration Plan

无需迁移。此变更纯新增功能，不影响现有代码行为。

**Rollback Plan**: 删除新增的链接元素和样式类，恢复原组件状态。无数据变更，回滚零风险。

## Open Questions

- Home 链接的具体 URL 是什么？（需确认项目首页地址）
- GitHub 链接指向哪个仓库？（需确认仓库 URL）
- 导航栏和 Footer 当前使用的具体组件名称和文件路径？（需探索代码结构）