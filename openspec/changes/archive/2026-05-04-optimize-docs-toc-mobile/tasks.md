## 1. TOC 组件重构

- [x] 1.1 重构 TOC 组件为全屏抽屉模式（从右侧滑入）
- [x] 1.2 通过 Portal 渲染按钮到 Header 导航栏 slot
- [x] 1.3 移除遮罩层，使用纯抽屉展示
- [x] 1.4 添加抽屉过渡动画（transition-transform duration-300）
- [x] 1.5 添加关闭按钮，图标尺寸与 Header 元素一致（h-4 w-4）

## 2. Header 组件适配

- [x] 2.1 在 Header 组件中添加 TOC 按钮 slot（#header-toc-slot）
- [x] 2.2 slot 仅在移动端显示（lg:hidden）
- [x] 2.3 确保 slot 与其他导航元素对齐（flex items-center）

## 3. 文档页面布局优化

- [x] 3.1 更新 docs.$slug.tsx 使用新的 MobileTOCDrawer 组件
- [x] 3.2 确保桌面端布局保持不变（lg 断点以上）

## 4. 样式优化

- [x] 4.1 抽屉 Header 高度与页面 Header 一致（h-14）
- [x] 4.2 抽屉标题字体与 Header 一致（text-sm）

## 5. 测试验证

- [x] 5.1 验证全屏抽屉展示效果
- [x] 5.2 验证目录滚动体验
- [x] 5.3 验证桌面端布局不受影响
- [x] 5.4 验证 TSLA 分析报告页面移动端阅读体验