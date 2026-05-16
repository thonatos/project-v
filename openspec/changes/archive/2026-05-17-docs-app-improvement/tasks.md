## 1. ErrorBoundary 实现

- [x] 1.1 在 `root.tsx` 添加根级 ErrorBoundary（`ErrorBoundary` 导出），显示友好错误页，包含返回首页链接
- [x] 1.2 在 `docs.$slug.tsx` 添加路由级 ErrorBoundary，捕获文档加载失败，保持导航可用
- [x] 1.3 验证 ErrorBoundary 捕获 loader 异常时正确显示错误页面

## 2. 统一标签系统

- [x] 2.1 在 `docs.ts` 中定义并导出 `TECH_TAGS` 和 `TRADING_TAGS` 只读数组
- [x] 2.2 在 `docs.ts` 中实现 `isTechTag(tag: string): boolean` 和 `isTradingTag(tag: string): boolean` 工具函数
- [x] 2.3 修改 `tech._index.tsx`，移除内联 `TECH_TAGS` 硬编码，改为从 `~/lib/docs` 导入
- [x] 2.4 修改 `trading._index.tsx`，移除内联 `TRADING_TAGS` 硬编码，改为从 `~/lib/docs` 导入
- [x] 2.5 验证 tech 和 trading 页面筛选结果与之前一致

> **Note:** tech 和 trading 路由已删除，统一标签系统不再需要。相关代码已从 `docs.ts` 移除。

## 3. 文案与 UI 修复

- [ ] 3.1 修改 `root.tsx` 的 meta description 为真实描述
- [ ] 3.2 修改 `_index.tsx` 首页 Hero 文案，替换 "undefined project"
- [x] 3.3 修改 `footer.tsx`，将 ❤ emoji 替换为 lucide-react Heart 图标

## 4. 代码质量

- [x] 4.1 修复 `mermaid-renderer.tsx` 中的 `catch (e: any)`，改为 `catch (e: unknown)` + 类型守卫
- [x] 4.2 确保项目通过 `pnpm lint` 和 `pnpm typecheck`