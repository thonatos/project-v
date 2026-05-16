## Context

docs-app 是基于 React Router v7 的文档展示应用，当前存在以下问题：

**现状：**
- 根路由 (`root.tsx`) 和文档路由 (`docs.$slug.tsx`) 都没有 ErrorBoundary，任何未捕获异常都导致空白页
- `tech._index.tsx` 和 `trading._index.tsx` 各自维护独立的硬编码标签数组，存在重复和重叠
- 首页和 meta 标签使用 "undefined project" 等占位文案
- Footer 使用 emoji ❤

**约束：**
- 使用 React Router v7 的 ErrorBoundary 机制（路由级错误边界）
- 不引入新的外部依赖
- 标签系统改动需保持向后兼容

## Goals / Non-Goals

**Goals:**
- 为根路由和 docs 路由分别添加 ErrorBoundary，实现友好的错误展示
- 将 TECH_TAGS 和 TRADING_TAGS 统一到 `docs.ts` 管理
- 移除所有占位文案和 emoji
- 保持现有功能不受影响

**Non-Goals:**
- 不做 Markdown 处理性能优化（留作后续单独议题）
- 不修改 docs-app 的视觉样式（配色、布局等）
- 不添加新的路由或页面

## Decisions

### 决策 1：ErrorBoundary 实现方式

**选择：** 使用 React Router v7 的 `ErrorBoundary` 组件配合 `ErrorComponent`

React Router v7 支持在路由配置或路由文件（如 `_layout.tsx`）中使用 `ErrorBoundary` 导出：

```tsx
// root.tsx 或 _layout.tsx
export function ErrorBoundary() {
  return <div>出错啦~</div>;
}
```

**替代方案考虑：**
- `React.ComponentDidCatch`：传统 React 错误边界，但需要 class component
- `window.onerror` / `unhandledrejection`：全局捕获但粒度粗，不适合 SPA 路由场景

**结论：** 使用 React Router 原生的 `ErrorBoundary` 导出，最符合框架设计。

---

### 决策 2：统一标签系统结构

**选择：** 在 `docs.ts` 中定义并导出标签常量及工具函数

```typescript
// TECH_TAGS: 技术类标签集合
export const TECH_TAGS = [...] as const;

// TRADING_TAGS: 交易类标签集合
export const TRADING_TAGS = [...] as const;

// 工具函数
export function isTechTag(tag: string): boolean;
export function isTradingTag(tag: string): boolean;
```

**替代方案考虑：**
- 单独创建 `lib/tags.ts`：增加新文件，小幅改动
- 创建 `config/tags.ts`：增加 config 目录，更明确

**结论：** 放在 `docs.ts` 中最直接，因为标签本身就是文档元数据的一部分，当前 `getAllDocs` 已处理标签逻辑。

---

### 决策 3：Footer emoji 处理

**选择：** 移除 emoji，使用 lucide-react 的 Heart icon

```tsx
import { Heart } from 'lucide-react';
// Built with <Heart className="h-3 w-3 text-red-400" /> React Router
```

**替代方案考虑：**
- 纯文字 "Built with love"：丢失视觉表达
- 其他 SVG 图标：Heart 最直观

**结论：** 使用 lucide-react 已有的 Heart 图标（docs-app 已安装 lucide-react）。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| ErrorBoundary 捕获范围过大，导致正常错误也被拦截 | 根级 ErrorBoundary 只做兜底，docs 路由单独配置 ErrorBoundary |
| TECH_TAGS/TRADING_TAGS 重叠导致分类不准确 | 通过 `isTechTag` 和 `isTradingTag` 分开判断，职责单一 |
| 首页文案不确定 | proposal 阶段标记为 "待确认"，实现时使用当前认知填写 |