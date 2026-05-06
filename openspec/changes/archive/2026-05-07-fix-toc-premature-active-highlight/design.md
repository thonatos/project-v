## Context

docs-app 的 `TOCProvider` 组件使用 `IntersectionObserver` 追踪页面滚动位置，将当前可见 heading 的 id 设置为 `activeId`，驱动 TOC 条目的 active 高亮。`IntersectionObserver` 在创建后会对视口内已有的被观察元素立即触发回调，导致页面刚加载时 `activeId` 就被赋值，TOC 第一个条目提前显示 active 颜色。

当前状态：
- `activeId` 初始值为空字符串 `''`
- `IntersectionObserver` 创建后立即触发，首个可见 h2 被标记为 active
- active 条目颜色（`--color-primary: #8264ff`）与 hover 颜色完全一致，视觉上无法区分

约束：
- 仅修改 `toc.tsx` 一个文件
- 不引入新依赖
- 不改变 TOC 的视觉设计（颜色、布局）

## Goals / Non-Goals

**Goals:**

- 页面初始加载时，TOC 所有条目统一显示为非活跃状态
- 用户首次滚动后，正常激活 IntersectionObserver 的高亮逻辑
- URL 带 hash 导航时，直接高亮对应条目

**Non-Goals:**

- 不改变 active/hover 的颜色值（不在此次修复范围内调整色彩方案）
- 不改变 IntersectionObserver 的 `rootMargin` 配置
- 不重构 TOC 组件的整体架构

## Decisions

### 决策 1：使用 `hasScrolled` 状态门控 activeId 更新

在 `TOCProvider` 中增加 `hasScrolled` 布尔状态，仅在 `hasScrolled === true` 时才将 IntersectionObserver 的结果写入 `activeId`。

**时序：**

```
页面加载                    用户滚动                 用户滚动中
   │                          │                       │
   ▼                          ▼                       ▼
useEffect 挂载             scroll 事件触发           Observer 持续回调
IntersectionObserver       hasScrolled = true       entry.isIntersecting
   │                          │                       │
   ▼                          ▼                       ▼
Observer 首次回调          Observer 回调             activeId 更新 ✓
entry.isIntersecting      entry.isIntersecting
   │                          │
   ▼                          ▼
hasScrolled = false       hasScrolled = true
→ 不更新 activeId          → activeId 更新 ✓
```

**备选方案：**

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| A. `hasScrolled` 门控 | 语义清晰，改动最小 | 需额外 scroll 监听 | **采用** |
| B. `requestAnimationFrame` 延迟 | 无需 scroll 监听 | 时序不可靠，竞争条件 | 排除 |
| C. 初始化时不挂载 Observer | 彻底避免首次触发 | 需要延迟挂载，复杂度高 | 排除 |

### 决策 2：URL hash 导航直接激活

若 `window.location.hash` 非空，页面加载时直接设置 `activeId` 为 hash 对应的 id（去掉 `#` 前缀），并将 `hasScrolled` 设为 `true`，跳过等待滚动的逻辑。

**理由**：用户通过带 hash 的链接进入页面时，明确指向了某个 heading，此时应该立即高亮对应条目，无需等待滚动。

### 决策 3：scroll 事件监听方式

使用 `window.addEventListener('scroll', ...)` 配合 `{ once: true }` 选项。首次触发后自动移除监听器，避免持续占用资源。

**理由**：`once: true` 自动清理，代码简洁，无内存泄漏风险。需要设置 `passive: true` 以优化滚动性能。

## Risks / Trade-offs

- **[极短延迟]** scroll 事件在 `hasScrolled` 设为 true 之前的那一帧，Observer 可能已经触发了回调但被忽略 → 缓解：实际影响可忽略，用户无法感知单帧差异
- **[hash 不匹配]** URL hash 对应的 heading 不存在或 id 不一致 → 缓解：设置前检查 `document.getElementById(hash)` 是否存在，不存在则仍等待滚动
- **[程序化滚动]** 代码触发的 `scrollTo` 不会触发 scroll 事件 → 缓解：当前场景不存在程序化滚动，无需处理
