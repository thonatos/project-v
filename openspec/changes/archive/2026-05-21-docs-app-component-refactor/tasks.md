## 1. 布局重构

- [x] 1.1 创建 `BasicLayout.tsx`：Header + Outlet + Footer，统一页面容器样式
- [x] 1.2 创建 `DocLayout.tsx`：TOCProvider + MobileTOCDrawer + DesktopTOC + Outlet + 内容网格布局
- [x] 1.3 更新 `routes.ts`：分离 basic-layout 和 doc-layout 路由配置
- [x] 1.4 重命名 `header.tsx` → `Header.tsx`
- [x] 1.5 重命名 `footer.tsx` → `Footer.tsx`
- [x] 1.6 更新路由文件中的组件引用

## 2. 组件合并

- [x] 2.1 创建 `TagChip.tsx`：合并 tag-badge 和 linked-tag-pill 功能，通过 `href` 和 `count` prop 区分
- [x] 2.2 创建 `ArticleCard.tsx`：合并 article-card 和 article-summary-card，支持 `variant="grid|list"`
- [x] 2.3 更新 `ContentPanel.tsx`：支持更多 variant 变体
- [x] 2.4 更新所有路由文件中的组件引用
- [x] 2.5 移除旧的组件文件（tag-badge.tsx, linked-tag-pill.tsx, article-card.tsx, article-summary-card.tsx）

## 3. TOC 重构

- [x] 3.1 重构 `toc.tsx`：移除 `document.getElementById` DOM slot 反模式
- [x] 3.2 将 TOCProvider 改为直接渲染 MobileTOCMenuButton 和 MobileTOCDrawer
- [x] 3.3 验证移动端 TOC 功能正常

## 4. 依赖清理

- [x] 4.1 移除 `prose-image.tsx` 中对 `next-themes` 的依赖
- [x] 4.2 移除 `{scheme}` 占位符替换逻辑
- [x] 4.3 验证图片灯箱功能正常

## 5. 验证与清理

- [x] 5.1 浏览器测试：首页、文档详情页、标签列表页、标签详情页
- [x] 5.2 验证所有路由导航正常
- [x] 5.3 清理未使用的组件文件
- [x] 5.4 运行 lint 检查
