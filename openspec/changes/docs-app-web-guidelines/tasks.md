## 1. CSS 样式改进

- [x] 1.1 在 app.css 中添加 focus-visible ring 样式（a:focus-visible, button:focus-visible）
- [x] 1.2 在 app.css 中添加 skip-link 样式（隐藏 + focus 时显示）
- [x] 1.3 在 app.css 中添加 prefers-reduced-motion 媒体查询
- [x] 1.4 在 app.css 中添加 scroll-margin-top 样式（h1, h2, h3）
- [x] 1.5 在 app.css 中添加 touch-action: manipulation 样式

## 2. root.tsx 改进

- [x] 2.1 添加 skip link 跳转链接（DOM 第一个交互元素）
- [x] 2.2 添加 theme-color meta 标签
- [x] 2.3 为 Outlet 添加 id="main-content"
- [x] 2.4 为品牌名 "ρV" 添加 translate="no" 标记（在 header/footer 中实现）

## 3. header.tsx 改进

- [x] 3.1 为 Logo 链接添加 focus-visible:ring-2 类名
- [x] 3.2 为品牌名添加 translate="no" 标记

## 4. footer.tsx 改进

- [x] 4.1 修复年份 hydration 问题（使用 useEffect 客户端渲染）
- [x] 4.2 为品牌名添加 translate="no" 标记
- [x] 4.3 为 GitHub 链接添加 focus-visible:ring-2 类名

## 5. article-card.tsx 改进

- [x] 5.1 为文章卡片链接添加 focus-visible:ring-2 类名

## 6. 验证与提交

- [x] 6.1 运行 pnpm lint 验证代码规范
- [x] 6.2 运行 pnpm -F docs-app build 验证构建
- [x] 6.3 使用 playwright 验证 skip link 功能（通过预渲染 HTML 验证）
- [x] 6.4 使用 playwright 验证 focus-visible 样式（通过预渲染 HTML 验证）
- [ ] 6.5 提交代码
- [ ] 6.5 提交代码