## ADDED Requirements

### Requirement: TOC 初始加载时不高亮任何条目

TOCProvider 在页面初始加载时，SHALL 不对任何 TOC 条目应用 active 高亮样式。所有条目 SHALL 显示为非活跃状态（`--color-text-muted` 颜色）。

#### Scenario: 页面首次加载无 hash
- **WHEN** 用户打开文档页面，URL 不包含 hash，且未进行任何滚动
- **THEN** TOC 所有条目 SHALL 显示为非活跃状态，无一例外

#### Scenario: 页面首次加载有 hash
- **WHEN** 用户通过带 hash 的 URL 进入页面（如 `/docs/foo#架构`），且 hash 对应的 heading 在 DOM 中存在
- **THEN** TOC 中 id 与 hash 匹配的条目 SHALL 立即显示为 active 状态

#### Scenario: 页面首次加载有无效 hash
- **WHEN** 用户通过带 hash 的 URL 进入页面，但 hash 对应的 heading 在 DOM 中不存在
- **THEN** TOC 所有条目 SHALL 显示为非活跃状态，与无 hash 场景一致

### Requirement: 用户首次滚动后激活 TOC 高亮

TOCProvider SHALL 在检测到用户首次滚动后，启用 IntersectionObserver 的高亮逻辑，使 `activeId` 根据当前可见 heading 更新。

#### Scenario: 用户向下滚动
- **WHEN** 用户在文档页面上首次滚动
- **THEN** IntersectionObserver 的回调结果 SHALL 开始生效，`activeId` 根据视口中可见的 heading 更新

#### Scenario: 滚动激活后持续跟踪
- **WHEN** TOC 高亮已被滚动激活
- **THEN** 后续滚动中 activeId SHALL 持续根据 IntersectionObserver 的结果更新，无需用户再次触发

### Requirement: 滚动监听器自动清理

TOCProvider 用于检测首次滚动的 scroll 事件监听器 SHALL 在首次触发后自动移除，不持续占用资源。

#### Scenario: 首次滚动后监听器移除
- **WHEN** 用户首次滚动触发 scroll 事件
- **THEN** scroll 事件监听器 SHALL 被移除，后续滚动不再触发该监听器
