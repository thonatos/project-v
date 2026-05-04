## 1. CSS 变量和主题配色系统

- [x] 1.1 更新 `app/app.css` 中 `:root` CSS 变量定义，改为青绿色系配色
- [x] 1.2 添加背景渐变效果（从白色到 teal-50）
- [x] 1.3 更新 prose 样式中标题的青绿色装饰效果（h1 下划线、h2 左边框）
- [x] 1.4 更新 prose 链接样式为青绿色系（默认 teal-600，hover teal-500）
- [x] 1.5 检查并更新代码块高亮配色以配合新主题

## 2. Tag Badge 配色统一与重构

- [x] 2.1 创建 `app/lib/tag-colors.ts` 共享配色配置文件
- [x] 2.2 更新 `app/components/tag-badge.tsx` 使用共享配置和青绿色系
- [x] 2.3 更新 `app/routes/tags._index.tsx` 删除重复的 TAG_COLORS，使用共享配置
- [x] 2.4 在共享配置中定义青绿色系颜色池（teal、cyan、emerald）

## 3. 导航栏布局重构

- [x] 3.1 重构 `app/components/header.tsx` 为左右分栏布局
- [x] 3.2 左侧保持 logo 区域（文字 "ρV undefined project"）
- [x] 3.3 右侧添加导航链接：Tags、Tech、Trading
- [x] 3.4 导航链接使用竖线分割（border-left，浅灰色）
- [x] 3.5 第一个链接不显示分割线
- [x] 3.6 保持 GitHub 图标链接在右侧末尾
- [x] 3.7 实现响应式布局：移动端隐藏部分链接

## 4. 层次感设计（克制使用）

- [x] 4.1 为文档详情页标题区域添加浅色线框样式
- [x] 4.2 使用 `bg-gray-50/50 border border-gray-100 rounded-lg` 样式
- [x] 4.3 确保不在大范围区域使用 card 或阴影效果
- [x] 4.4 保持 Article Card 的现有底部边框样式

## 5. 新增路由页面

- [x] 5.1 在 `app/routes.ts` 中添加 `/tech` 和 `/trading` 路由
- [x] 5.2 创建 `app/routes/tech._index.tsx` 页面（筛选 tech 标签文档）
- [x] 5.3 创建 `app/routes/trading._index.tsx` 页面（筛选 trading 标签文档）
- [x] 5.4 新页面使用与 tags.$tag.tsx 相似的结构

## 6. 组件 CSS 变量检查

- [x] 6.1 检查 `app/components/article-card.tsx` CSS 变量使用是否兼容新配色
- [x] 6.2 检查 `app/components/footer.tsx` CSS 变量使用是否兼容新配色
- [x] 6.3 检查 `app/components/toc.tsx` CSS 变量使用是否兼容新配色
- [x] 6.4 检查所有路由页面 CSS 变量使用是否兼容新配色

## 7. 测试与验证

- [x] 7.1 启动 dev server (`pnpm -F docs-app dev`) 验证视觉效果
- [x] 7.2 使用 Playwright 检查桌面端和移动端显示效果
- [x] 7.3 确认所有导航链接正常工作
- [x] 7.4 确认竖线分割样式正确显示
- [x] 7.5 确认背景渐变效果美观且不影响可读性
- [x] 7.6 确认层次感设计克制、不过度使用
- [x] 7.7 确认回滚方案可用（保留原 CSS 变量注释）