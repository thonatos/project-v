## Why

docs-app 目前存在几个影响用户体验和代码可维护性的问题：缺乏错误边界导致路由异常时显示空白页；TECH_TAGS 和 TRADING_TAGS 硬编码在两个独立文件中重复维护；首页和 meta 信息使用占位文案；Markdown 处理缺少缓存机制。需要通过 ErrorBoundary 和统一标签系统来解决这些问题。

## What Changes

- **新增 ErrorBoundary**: 在根路由和文档路由层级添加 React Router v7 ErrorBoundary，提供友好的错误提示而非空白页
- **统一标签系统**: 将 TECH_TAGS 和 TRADING_TAGS 从各自独立的硬编码数组迁移到 `docs.ts` 作为统一的导出常量，消除重复维护
- **规范化首页文案**: 将 "undefined project" 等占位文案替换为真实描述
- **移除 Footer emoji**: 将 "Built with ❤" 改为图标或文字表意
- **优化 Markdown 处理** *(可选)*: 添加简单内存缓存减少重复解析开销

## Capabilities

### New Capabilities

- `error-boundary`: ErrorBoundary 能力
  - 根级 ErrorBoundary：捕获所有未处理异常，显示友好错误页面
  - 文档页 ErrorBoundary：捕获单篇文档加载失败，保留导航可用
  - 错误状态时显示返回首页链接，不泄漏技术细节

- `unified-tag-system`: 统一标签系统
  - `docs.ts` 导出 `TECH_TAGS` 和 `TRADING_TAGS` 统一管理
  - 提供 `isTechTag(tag)` 和 `isTradingTag(tag)` 工具函数
  - `tech._index.tsx` 和 `trading._index.tsx` 从 `docs.ts` 导入标签数组

### Modified Capabilities

- `docs-app-config`: docs-app 项目配置
  - 首页 Hero 文案从占位改为真实描述（待确认项目定位后填写）
  - Footer 移除 emoji，改用 SVG 图标或纯文字

## Impact

- **新增依赖**: 无
- **修改文件**:
  - `packages/apps/docs-app/app/root.tsx`: 添加根级 ErrorBoundary
  - `packages/apps/docs-app/app/routes/docs.$slug.tsx`: 添加嵌套 ErrorBoundary
  - `packages/apps/docs-app/app/lib/docs.ts`: 统一导出标签常量和工具函数
  - `packages/apps/docs-app/app/routes/tech._index.tsx`: 从 docs.ts 导入 TECH_TAGS
  - `packages/apps/docs-app/app/routes/trading._index.tsx`: 从 docs.ts 导入 TRADING_TAGS
  - `packages/apps/docs-app/app/components/footer.tsx`: 移除 emoji
  - `packages/apps/docs-app/app/routes/_index.tsx`: 规范化首页文案
- **回滚计划**: 如需回滚，保留原 hardcoded TECH_TAGS/TRADING_TAGS 副本即可无损恢复