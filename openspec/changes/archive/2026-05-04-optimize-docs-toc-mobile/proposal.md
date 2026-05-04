## Why

移动端阅读 TSLA 分析报告时，TOC（目录）面板显示不完整且存在滚动条，用户体验不佳。当前移动端 TOC 使用 `max-h-64`（256px）高度限制配合 `overflow-y-auto`，导致用户必须在狭小区域内滚动查看完整目录，阅读体验受限。

## What Changes

- 优化移动端 TOC 面板布局，提升目录可读性
- 调整 TOC 面板高度限制，根据屏幕尺寸动态适配
- 改进 TOC 面板位置和触发方式，提供更自然的交互体验
- 优化整体文档页面布局的响应式设计

## Capabilities

### New Capabilities

- `docs-mobile-toc`: 移动端目录导航优化，提供更好的移动端目录浏览体验

### Modified Capabilities

- `docs-toc-navigation`: 修改响应式 TOC 显示需求，从"隐藏或折叠"改为"优化的移动端展示方案"

## Impact

- 影响文件：
  - `packages/apps/docs-app/app/components/toc.tsx` - TOC 组件
  - `packages/apps/docs-app/app/routes/docs.$slug.tsx` - 文档页面布局
  - `packages/apps/docs-app/app/app.css` - 响应式样式
- 不影响 API 或数据结构
- 不影响桌面端体验（lg 断点以上保持现有布局）