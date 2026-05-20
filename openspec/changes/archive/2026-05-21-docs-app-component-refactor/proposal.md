## Why

docs-app 目前存在多个设计问题：组件粒度划分过细（20+ 个组件文件）导致代码碎片化；重复的布局代码散落在各个路由中；tag-badge 与 linked-tag-pill 功能完全重复；toc.tsx 使用 DOM slot 反模式实现跨组件通信；prose-image.tsx 混用了不属于该项目的 next-themes 依赖。这些问题使得代码难以维护和扩展。

## What Changes

- **组件合并**：将 `tag-badge.tsx` 和 `linked-tag-pill.tsx` 合并为 `TagChip` 组件；将 `article-card.tsx` 和 `article-summary-card.tsx` 合并为 `ArticleCard` 组件
- **Layout 重构**：创建 `basic-layout.tsx` 和 `doc-layout.tsx` 两种布局组件，统一页面容器结构，消除路由中的重复布局代码
- **TOC 修复**：移除 `toc.tsx` 中的 `document.getElementById` DOM slot 反模式，改为 props 传递或 React Context
- **依赖清理**：移除 `prose-image.tsx` 中混用的 `next-themes`，改用 docs-app 自有的主题方案
- **重命名**：将 `header.tsx`/`footer.tsx` 简化为 `Header`/`Footer`（移除 Site 前缀）

## Capabilities

### New Capabilities

- `docs-app-layouts`：新增布局系统的 capability，统一管理 docs-app 的页面结构
- `docs-app-component-consolidation`：组件合并规范，定义哪些组件可以合并以及合并后的接口

### Modified Capabilities

- （无 spec 级别的需求变更，仅实现层面的重构）

## Impact

- **受影响的代码**：
  - `packages/apps/docs-app/app/components/` 下的组件文件
  - `packages/apps/docs-app/app/routes/` 下的路由文件
- **依赖变更**：移除 `prose-image.tsx` 对 `next-themes` 的依赖
- **Breakding Change**：路由组件的引用方式变更，需要更新 import路径

## Rollback Plan

如需回滚，可通过 git revert 恢复：

1. 保留重构前的组件文件副本（移动到 `components/legacy/` 目录）
2. 回滚路由文件的 import 引用
3. 移除新创建的 layout 文件
4. 恢复 `prose-image.tsx` 对 `next-themes` 的依赖（如需）