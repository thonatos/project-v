## 1. 状态与逻辑修改

- [x] 1.1 在 `TOCProvider` 中新增 `hasScrolled` 状态（`useRef<boolean>(false)`）
- [x] 1.2 修改 `IntersectionObserver` 回调：仅在 `hasScrolledRef.current === true` 时才调用 `setActiveId`
- [x] 1.3 新增 scroll 事件监听 `useEffect`：使用 `window.addEventListener('scroll', handler, { once: true, passive: true })`，回调中设置 `hasScrolledRef.current = true`
- [x] 1.4 新增 URL hash 导航处理 `useEffect`：若 `window.location.hash` 非空且 `document.getElementById(hash)` 存在，则直接设置 `activeId` 为对应 id 并将 `hasScrolledRef.current` 设为 `true`

## 2. 验证

- [x] 2.1 启动 docs-app dev server，打开文档页面，确认 TOC 初始加载时无任何 active 高亮
- [x] 2.2 滚动页面，确认首次滚动后 TOC 正确高亮当前可见 heading
- [x] 2.3 通过带 hash 的 URL 访问文档页面，确认直接高亮对应条目
- [x] 2.4 通过带无效 hash 的 URL 访问，确认 TOC 无高亮，滚动后正常激活
