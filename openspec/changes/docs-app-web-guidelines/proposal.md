## Why

docs-app 当前未完全遵循 Web Interface Guidelines，存在以下问题：
- **无障碍访问**：缺少 focus-visible 状态、跳转链接、键盘导航支持
- **Hydration 安全**：Footer 中的 `new Date().getFullYear()` 导致服务端/客户端渲染不一致
- **动画与交互**：缺少 `prefers-reduced-motion` 支持、缺少触摸优化
- **性能与布局**：缺少标题锚点的 `scroll-margin-top`、缺少 `theme-color` meta 标签

遵循这些指南可以提升用户体验、无障碍访问性和 SEO 排名。

## What Changes

- 添加 focus-visible 状态样式，确保键盘导航可见
- 添加 skip link 跳转链接，支持无障碍用户快速跳过导航
- 修复 Footer 年份 hydration 问题，使用静态年份或客户端渲染
- 添加 `prefers-reduced-motion` CSS 媒体查询，尊重用户动画偏好
- 添加 `scroll-margin-top` 样式，确保锚点跳转正确对齐
- 添加 `theme-color` meta 标签，匹配页面背景色
- 添加触摸优化样式（`touch-action: manipulation`）
- 为品牌名 "ρV" 添加 `translate="no"`，防止自动翻译破坏显示

## Capabilities

### New Capabilities

- `docs-accessibility`: 无障碍访问增强，包括 focus-visible、skip link、键盘导航
- `docs-hydration-safety`: Hydration 安全改进，修复日期渲染问题
- `docs-motion-preference`: 动画偏好支持，尊重 `prefers-reduced-motion`

### Modified Capabilities

- `docs-ui`: 扩展 UI 规格，增加 theme-color meta、触摸优化、scroll-margin-top

## Impact

**Affected Files:**
- `packages/apps/docs-app/app/app.css` - 添加 focus-visible、reduced-motion、scroll-margin-top 样式
- `packages/apps/docs-app/app/root.tsx` - 添加 skip link、theme-color meta、translate="no"
- `packages/apps/docs-app/app/components/footer.tsx` - 修复 hydration 问题
- `packages/apps/docs-app/app/components/header.tsx` - 添加 focus-visible 支持

**No Breaking Changes** - 所有改进为渐进增强，不影响现有功能。

**Rollback Plan:**
如有问题，可通过 git revert 回滚此变更。所有改动为 CSS 和模板层面的增量修改，无数据层影响。