## 1. 项目初始化

- [x] 1.1 创建 `packages/apps/docs-app/` 目录结构
- [x] 1.2 创建 `package.json` 配置依赖（react-router、mdx、mermaid、tailwindcss v4）
- [x] 1.3 创建 `tsconfig.json` TypeScript 配置
- [x] 1.4 创建 `react-router.config.ts` 配置 SPA 模式（ssr: false）
- [x] 1.5 创建 `vite.config.ts` 配置 MDX 和 Tailwind v4 插件
- [x] 1.6 创建 `app.css` Tailwind CSS 入口样式文件

## 2. 基础布局实现（Compass 风格）

- [x] 2.1 创建 `app/root.tsx` 根布局组件
- [x] 2.2 创建 `app/routes/_layout.tsx` 简约单列布局（顶部导航 + 主内容区）
- [x] 2.3 创建顶部导航组件 `app/components/header.tsx`（Logo + 主题切换）
- [x] 2.4 创建页脚组件 `app/components/footer.tsx`
- [x] 2.5 配置 `@tailwindcss/typography` 插件优化文档排版
- [x] 2.6 实现响应式布局断点（桌面/平板/移动端）

## 3. 文件路由实现（静态 MDX 路由）

- [x] 3.1 配置 `@react-router/fs-routes` 约定式路由，支持 `.mdx` 文件
- [x] 3.2 配置 MDX frontmatter 提取（标题、日期、摘要）
- [x] 3.3 创建 `app/routes/_index.tsx` 首页（glob import 所有 MDX frontmatter 生成文章卡片列表）
- [x] 3.4 创建文章卡片组件 `app/components/article-card.tsx`（日期、标题、摘要）
- [x] 3.5 创建示例文档 `app/content/docs/getting-started.mdx`
- [x] 3.6 创建示例手稿 `app/content/manuscripts/my-thoughts.mdx`

## 4. MDX 内容处理

- [x] 4.1 配置 `@mdx-js/react-loader` Vite 插件
- [x] 4.2 创建 MDX 组件映射配置（标题、段落、代码块、分隔线等）
- [x] 4.3 配置 Shiki 语法高亮，支持多种语言（tsx、ts、js、bash、python、go、rust、json、yaml）
- [x] 4.4 创建代码块组件，支持文件名标签、行号显示、复制按钮
- [x] 4.5 配置代码块亮色/暗色主题适配
- [x] 4.6 实现图片 `{scheme}` 占位符替换（亮色/暗色自适应）
- [x] 4.7 创建图片预览组件 `app/components/prose-image.tsx`（点击放大、ESC关闭、缩放拖动）

## 5. TOC 目录大纲

- [x] 5.1 创建 `app/components/toc.tsx` 目录大纲组件（提取 h2/h3 标题）
- [x] 5.2 实现 IntersectionObserver 监听滚动高亮当前章节
- [x] 5.3 实现 TOC 响应式：桌面端右侧固定，移动端隐藏
- [x] 5.4 标题 anchor 链接支持（点击跳转到对应位置）

## 6. Mermaid 流程图支持

- [x] 6.1 安装 `mermaid` 包依赖
- [x] 6.2 创建 `app/components/mermaid-diagram.tsx` React 组件封装
- [x] 6.3 配置 MDX 中识别 `mermaid` 代码块自动渲染
- [x] 6.4 实现 Mermaid 语法错误提示处理
- [x] 6.5 创建包含流程图的示例文档验证功能

## 7. 构建与测试

- [x] 7.1 配置 `pnpm -F docs-app build` 构建脚本
- [x] 7.2 配置 `pnpm -F docs-app dev` 开发服务器
- [x] 7.3 运行 biome lint 检查代码规范
- [x] 7.4 验证所有路由页面正常渲染
- [x] 7.5 验证暗色模式切换功能
- [x] 7.6 验证图片自适应主题功能
- [x] 7.7 验证 TOC 目录大纲功能（桌面端显示、移动端隐藏）
- [x] 7.8 验证图片预览功能（点击放大、关闭）
- [x] 7.9 验证响应式布局（桌面/平板/移动端）
- [x] 7.10 验证代码高亮功能（多语言、文件名标签、行号、复制按钮、暗色模式）