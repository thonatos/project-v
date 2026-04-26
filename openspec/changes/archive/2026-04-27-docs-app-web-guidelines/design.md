## Context

docs-app 是一个使用 React Router v7 的静态文档站点。当前实现已完成基础功能，但在 Web Interface Guidelines 合规性方面存在不足：

**当前状态：**
- Header 和 Footer 组件缺少 focus-visible 状态
- Footer 使用 `new Date().getFullYear()` 导致 hydration 不一致
- CSS 缺少 `prefers-reduced-motion` 媒体查询
- 缺少 skip link 无障碍跳转链接
- 标题缺少 `scroll-margin-top` 锚点偏移

**约束：**
- 必须保持 SSG 预渲染兼容性
- 所有改进为渐进增强，不影响核心功能
- 遵循 Web Interface Guidelines 规范

## Goals / Non-Goals

**Goals:**
- 完成所有 Web Interface Guidelines 检查项合规
- 提升键盘导航和无障碍体验
- 确保 SSR/CSR hydration 一致性
- 尊重用户动画偏好设置

**Non-Goals:**
- 不重构现有组件架构
- 不添加新的功能特性（如搜索、评论等）
- 不改变现有视觉设计风格

## Decisions

### 1. Focus-visible 实现方式

**决策：** 使用 Tailwind CSS `focus-visible:ring-*` 类

**替代方案：**
- `:focus` 伪类：会导致点击时也显示 focus ring，体验不佳
- 自定义 CSS：维护成本高

**理由：** Tailwind v4 的 `focus-visible` 已内置支持，与现有 CSS 架构一致，代码简洁。

### 2. Footer 年份 Hydration 修复

**决策：** 使用客户端渲染（`useEffect` + `useState`）

**替代方案：**
- 硬编码年份：需要每年手动更新，维护成本高
- 服务端注入年份：需要额外 loader，增加复杂度

**理由：** React Router v7 的 SSR 架构下，客户端渲染年份是最简洁方案，且年份显示不影响 SEO。

### 3. Skip Link 实现

**决策：** 在 root.tsx 添加隐藏跳转链接，focus 时显示

**替代方案：**
- 组件级别实现：需要在每个页面添加，重复代码

**理由：** Skip link 应位于页面顶部（DOM 最前），root.tsx 是最佳位置。隐藏链接仅在键盘 focus 时显示，不影响视觉布局。

### 4. Reduced Motion 实现

**决策：** 在 CSS 中添加 `@media (prefers-reduced-motion: reduce)` 媒体查询

**替代方案：**
- JS 检测 + 条件类名：复杂度高，性能开销

**理由：** CSS 媒体查询是原生支持的 declarative 方式，性能最优，且与现有 CSS 架构一致。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Skip Link 可能影响布局 | 使用绝对定位 + opacity: 0，仅在 focus 时显示 |
| 年份客户端渲染可能短暂闪烁 | React hydration 快，实际闪烁概率低 |
| Reduced Motion 可能影响微交互体验 | 仅禁用 transition，保留基本 hover 状态 |

## Implementation Approach

```
┌─────────────────────────────────────────────────────────────┐
│                    root.tsx                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ <a href="#main-content" className="skip-link">      │    │
│  │   跳转到主要内容                                      │    │
│  │ </a>                                                │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ <meta name="theme-color" content="#ffffff">         │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ <Outlet /> (id="main-content")                      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    app.css                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ .skip-link { opacity: 0; position: absolute; }      │    │
│  │ .skip-link:focus { opacity: 1; z-index: 100; }      │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ @media (prefers-reduced-motion: reduce) {           │    │
│  │   * { transition: none !important; }                │    │
│  │ }                                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ a:focus-visible { ring-2 ring-primary; }            │    │
│  │ button:focus-visible { ring-2 ring-primary; }       │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ h1, h2, h3 { scroll-margin-top: 4rem; }             │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Migration Plan

**部署步骤：**
1. 更新 app.css 添加所有新样式
2. 更新 root.tsx 添加 skip link 和 meta 标签
3. 更新 footer.tsx 修复 hydration 问题
4. 更新 header.tsx 添加 focus-visible 类名
5. 运行 lint 和 build 验证
6. 提交代码

**回滚策略：**
使用 git revert 回滚此变更。所有改动为增量修改，无数据层影响，回滚无风险。