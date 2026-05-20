## Context

当前 docs-app 使用单层布局结构，所有路由都嵌套在 `_layout.tsx` 中。路由配置如下：

```ts
// routes.ts
export default [
  layout('routes/_layout.tsx', [
    index('routes/_index.tsx'),
    route('docs/:slug', 'routes/docs.$slug.tsx'),
    route('tags', 'routes/tags._index.tsx'),
    route('tags/:tag', 'routes/tags.$tag.tsx'),
  ]),
] satisfies RouteConfig;
```

问题：
1. `_layout.tsx` 包含所有页面的通用容器逻辑，但 doc 页面需要额外的 TOC 侧边栏
2. 组件文件粒度划分过细，20+ 个文件中存在大量重复功能的组件
3. `toc.tsx` 使用 `document.getElementById` 实现跨组件通信，这是 React 中的反模式
4. `prose-image.tsx` 混用了 `next-themes`，但 docs-app 是 react-router 项目

## Goals / Non-Goals

**Goals:**
- 统一页面布局，消除路由文件中的重复布局代码（`px-4 sm:px-6 lg:px-8 py-12 lg:max-w-7xl lg:mx-auto`）
- 支持多种布局类型：basic-layout（通用页面）和 doc-layout（文档详情，含 TOC）
- 合并功能重复的组件，减少代码碎片化
- 消除 DOM slot 反模式
- 清理混用的错误依赖

**Non-Goals:**
- 不修改文档内容渲染逻辑
- 不修改 `docs.ts` 中的数据获取逻辑
- 不新增功能，仅做重构

## Decisions

### Decision 1: 多 Layout 路由方案

**选择**：通过 React Router 的嵌套 layout 命名约定实现多布局支持。

**方案 A（当前）**：单一 layout，所有路由嵌套
```ts
layout('routes/_layout.tsx', [routes...])
```

**方案 B（错误）**：分离 layout，使用多个独立的 layout 路由
```ts
layout('routes/basic-layout.tsx', [...])
layout('routes/doc-layout.tsx', [...])
```

**方案 C（采用）**：利用 React Router 的嵌套 layout 文件命名约定
```ts
layout('routes/_layout.tsx', [
  layout('routes/docs._layout.tsx', [
    route('docs/:slug', 'routes/docs.$slug.tsx'),
  ]),
  index('routes/_index.tsx'),
  route('tags', 'routes/tags._index.tsx'),
  route('tags/:tag', 'routes/tags.$tag.tsx'),
]),
```

- `routes/_layout.tsx` - 根布局，包含 Header、Footer 和通用页面容器
- `routes/docs._layout.tsx` - 文档嵌套布局，包含 TOCProvider、MobileTOCDrawer 和 DesktopTOC

**原因**：React Router 约定 `*_layout.tsx` 自动作为对应路由段的嵌套布局，无需修改 routes.ts 逻辑。

### Decision 2: 组件合并方案

| 原组件 | 合并后 | 合并策略 |
|--------|--------|----------|
| `tag-badge.tsx` | `TagChip` | 合并为单一组件，通过 `variant` prop 区分样式 |
| `linked-tag-pill.tsx` | `TagChip` | |
| `article-card.tsx` | `ArticleCard` | 保留，移除与 `article-summary-card` 的重复样式 |
| `article-summary-card.tsx` | `ArticleCard` | 合并，统一为 `variant="grid\|list"` |
| `content-panel.tsx` | `ContentPanel` | 保留，扩展 `variant` 支持更多样式变体 |
| `page-header.tsx` | `PageHeader` | 保留，或考虑并入 layout 层 |

**新组件结构**：
```
components/
├── header.tsx              # 重命名：header.tsx → header.tsx
├── footer.tsx             # 重命名：footer.tsx → footer.tsx
├── tag-chip.tsx             # 合并：tag-badge.tsx + linked-tag-pill.tsx
├── article-card.tsx         # 合并：article-card.tsx + article-summary-card.tsx
├── content-panel.tsx       # 保留，扩展 variant
├── toc/
│   ├── toc-provider.tsx    # 提取 TOCContext
│   ├── mobile-toc-drawer.tsx # 保留
│   └── desktop-toc.tsx      # 保留
└── ...
```

### Decision 3: TOC DOM Slot 修复方案

**问题**：`toc.tsx` 中 `MobileTOCMenuButton` 使用 `document.getElementById('header-toc-slot')` 将自己挂载到 Header 的 slot 中。

**修复方案**：将 TOC 相关组件的协调逻辑提取为 `TOCProvider`，通过 Context 传递状态，移除 Portal 依赖。

```tsx
// 新的 TOCProvider 结构
export function TOCProvider({ items, children }: TOCProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // ... 滚动监听逻辑

  return (
    <TOCContext.Provider value={{ isOpen, setIsOpen, activeId, items }}>
      {children}
      {/* MobileTOCMenuButton 和 MobileTOCDrawer 作为 TOCProvider 的子组件 */}
      <MobileTOCMenuButton />
      <MobileTOCDrawer />
    </TOCContext.Provider>
  );
}
```

**优点**：状态管理集中在 Provider 中，组件间通过 Context 通信，无需 DOM slot。

### Decision 4: prose-image.tsx 依赖清理

**问题**：`prose-image.tsx` 使用 `useTheme` from `next-themes`，但 docs-app 是 react-router 项目，不应该依赖 next。

**修复方案**：移除图片主题替换功能（`{scheme}` 占位符），或使用 CSS 变量实现主题感知。

```tsx
// 修复后：移除 next-themes 依赖
export function ProseImage({ src, alt }: ProseImageProps) {
  // 直接使用 src，不做主题替换
  return <img src={src} alt={alt} className="cursor-zoom-in ..." />;
}
```

如需主题感知，使用 CSS 变量或 `@media (prefers-color-scheme: dark)`。

## Risks / Trade-offs

[Risk] 路由配置变更可能影响现有路由  
[Mitigation] 通过 git 保存当前配置，变更有问题可快速回滚

[Risk] 组件合并可能导致已有 import 失效  
[Mitigation] 提供兼容层或批量更新 import 路径

[Risk] TOC 组件重构可能影响移动端 TOC 功能  
[Mitigation] 重构后进行浏览器测试验证

## Migration Plan

1. **第一阶段：创建文档嵌套布局**
   - 创建 `routes/docs._layout.tsx`，包含 TOCProvider、MobileTOCDrawer 和 DesktopTOC
   - routes.ts 中用 `layout('routes/docs._layout.tsx', [...])` 包裹文档路由
   - 创建 `TagChip.tsx`，保留 `tag-badge.tsx` 和 `linked-tag-pill.tsx` 作为兼容层
   - 创建 `ArticleCard.tsx`（合并版），保留原文件作为兼容层
   - 更新所有 import 引用

3. **第三阶段：TOC 重构**
   - 重构 `TOCProvider`，移除 DOM slot 依赖
   - 测试移动端 TOC 功能

4. **第四阶段：依赖清理**
   - 移除 `prose-image.tsx` 中对 `next-themes` 的依赖
   - 验证图片功能正常

5. **回滚方案**：
   ```bash
   git checkout HEAD~1 -- .
   ```

## Open Questions

1. **是否需要保留 `page-header.tsx`？** 该组件在 tags.$tag.tsx 和 tags._index.tsx 中使用，考虑是否并入 layout 层。

2. **组件重命名规范**：当前组件文件名是小写下划线（`article-card.tsx`），是否需要改为大写下划线（`ArticleCard.tsx`）？

3. **兼容层保留时间**：组件合并后，旧的组件文件是否保留一段时间作为兼容层？（建议保留 1 个版本周期）