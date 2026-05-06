## Why

docs-app 的桌面端 TOC（目录）在页面刚加载、用户尚未滚动时，就已经将第一个可见 heading 对应的条目高亮为 active 颜色（紫色 `#8264ff`），与 hover 状态颜色完全一致，让用户误以为鼠标正处于 hover 状态。根本原因是 `IntersectionObserver` 在创建后会立即对视口内已有的被观察元素触发回调，导致 `activeId` 在无任何用户交互的情况下就被赋值。

## What Changes

- TOC 组件增加滚动感知逻辑：仅在用户首次滚动（或通过 URL hash 导航）后才激活 IntersectionObserver 的高亮结果
- 页面加载时 TOC 所有条目统一显示为非活跃状态（灰色 `--color-text-muted`）
- 支持 URL hash 直接跳转场景：若页面加载时 URL 包含 hash，则直接高亮对应条目

## Capabilities

### New Capabilities

- `toc-scroll-awareness`: TOC 高亮仅在用户滚动交互或 hash 导航后才激活，页面初始加载时不显示任何 active 状态

### Modified Capabilities

（无已有 spec 需要修改）

## Impact

- 受影响文件：`packages/apps/docs-app/app/components/toc.tsx`（TOCProvider 组件的 `useEffect` 及状态逻辑）
- 无 API 变更、无依赖变更、无破坏性改动
- 回滚方案：删除 `hasScrolled` / `hashNav` 相关逻辑，恢复 `activeId` 初始值为空字符串且 IntersectionObserver 结果立即生效的行为（即当前状态）
