## Context

当前 monorepo 使用 pnpm 管理，已有多个应用包：
- `react-app`: React Router v7 SPA 应用
- `artusx-api`: Node.js API
- `remix-api` / `remix-flow`: Cloudflare Workers 应用

本设计目标是新增 `docs-app`，一个专注于文档和手稿展示的静态站点，采用 MDX 格式编写内容，支持 Mermaid 流程图渲染。

界面设计参考 Tailwind CSS Compass 风格（https://tailwindcss.com/blog/2025-05-14-compass-course-starter-kit）：
- 简约单列布局，内容为核心
- 清晰的排版层次（标题、段落、代码块）
- 代码块带文件名标签，深色背景
- 淡色分隔线分隔章节
- 亮色/暗色模式自适应图片（`{scheme}` 占位符）
- 无复杂侧边栏，纯内容流式布局

参考 `react-app` 的技术栈和路由配置方式，保持技术一致性。

## Goals / Non-Goals

**Goals:**
- 创建独立的文档应用包，支持 MDX 内容编写
- 采用约定式文件路由，基于目录结构自动生成路由
- 界面参考 Compass 风格：简约单列布局，以内容为核心
- 支持 TOC（目录大纲）组件，桌面端右侧显示，移动端隐藏
- 支持图片点击预览放大功能
- 支持代码高亮（多语言、文件名标签、行号、复制按钮）
- 支持 Mermaid 流程图渲染
- 支持响应式设计：桌面端（TOC 右侧）、平板（全宽）、移动端（全宽+TOC折叠）
- 支持亮色/暗色模式切换，代码块和图片自适应主题
- 与 monorepo 构建流程集成

**Non-Goals:**
- 不实现复杂侧边栏导航（保持简约）
- 不实现用户认证系统（纯静态文档站点）
- 不实现评论或互动功能（专注内容展示）
- 不实现全文搜索（后续可扩展）

## Decisions

### 1. 技术栈选择

**选择：React Router v7 + MDX + Tailwind CSS + Mermaid**

**理由：**
- React Router v7 与现有 `react-app` 保持一致，降低学习成本
- MDX 支持 Markdown + React 组件混合，扩展性强
- Tailwind CSS 与项目其他应用风格统一
- Mermaid 是业界标准的流程图渲染方案

**替代方案考虑：**
- Next.js + MDX：需要引入新框架，与现有技术栈不一致
- VitePress / Nuxt Content：非 React 技术栈
- Docusaurus：功能过于复杂，适合大型文档项目

### 2. 文件路由方案

**选择：`@react-router/fs-routes` 约定式路由 + MDX 文件直接作为路由**

**理由：**
- 与 `react-app` 使用相同的路由方案
- MDX 文件直接放在 `routes/` 目录，自动生成对应路由
- 无需动态路由加载，每篇文档是独立的静态路由
- 支持 frontmatter 提取元数据（标题、日期、摘要）

**路由结构设计（静态 MDX 文件）：**
```
app/routes/
├── _index.tsx               # 首页（自动读取所有 MDX 文件的 frontmatter 生成列表）
├── _layout.tsx              # 布局组件（顶部导航 + 主内容区）
├── docs/
│   ├── getting-started.mdx  # /docs/getting-started
│   └── architecture.mdx     # /docs/architecture
└── manuscripts/
│   ├── my-thoughts.mdx      # /manuscripts/my-thoughts
│   └── draft-01.mdx         # /manuscripts/draft-01
```

每篇 MDX 文件包含 frontmatter：
```yaml
---
title: Getting Started
date: 2025-04-25
description: A brief introduction to the docs app
---

# Getting Started

Content here...
```

首页 `_index.tsx` 通过 Vite 的 glob import 读取所有 MDX 文件的 frontmatter，生成文章卡片列表。

### 3. MDX 处理方案

**选择：`@mdx-js/react-loader` + Vite 插件 + Shiki 语法高亮**

**理由：**
- Vite 插件集成简单，构建性能好
- Shiki 提供高质量语法高亮，支持 VS Code 同款主题
- 支持自定义 MDX 组件

**自定义组件：**
- `img`: 包装为可点击预览的图片组件
- `h2/h3`: 添加 anchor 链接，用于 TOC 导航
- `pre/code`: 代码块带文件名标签、行号、复制按钮

### 4. 代码高亮方案

**选择：Shiki（基于 TextMate 语法）**

**理由：**
- 高质量语法高亮，与 VS Code 一致
- 支持多语言：tsx、ts、js、bash、python、go、rust、json、yaml 等
- 支持亮色/暗色双主题
- 可配置文件名标签、行号、复制按钮

**代码块特性：**
```
```tsx:app.tsx showLineNumbers
// 文件名标签显示在顶部
// 行号显示在左侧
// 复制按钮在右上角
```
```

### 5. TOC 目录大纲方案

**选择：基于 heading 提取 + IntersectionObserver**

**理由：**
- 从 MDX 渲染的 heading 元素提取标题结构
- 使用 IntersectionObserver 监听滚动，自动高亮当前章节
- 纯 CSS 响应式控制显示/隐藏

**响应式策略：**
- 桌面端（≥1024px）：TOC 固定右侧，跟随滚动
- 平板/移动端（<1024px）：TOC 隐藏，可通过底部按钮触发浮层

### 6. 图片预览方案

**选择：自定义 Modal 组件**

**理由：**
- 简单的点击放大预览需求
- 支持 ESC 关闭和点击外部关闭
- 支持图片缩放和拖动
- 无需额外依赖，保持轻量

### 7. Mermaid 渲染方案

**选择：`mermaid` 包 + React 组件封装**

**理由：**
- 官方 React 支持完善
- 支持服务端渲染（需要特殊处理）
- 支持多种图表类型

**渲染流程：**
```
MDX 文件 → 代码块识别 → Mermaid 组件 → 客户端渲染
```

## Risks / Trade-offs

### Risk 1: Mermaid SSR 兼容性
- **风险**：Mermaid 依赖 DOM API，SSR 模式下无法直接渲染
- **缓解**：使用客户端渲染，配置 React Router 的 SPA 模式（`ssr: false`）

### Risk 2: MDX 内容管理
- **风险**：大量文档内容可能导致包体积过大
- **缓解**：配置合理的代码分割策略，按路由懒加载 MDX 内容

### Risk 3: 样式一致性
- **风险**：新应用样式可能与现有应用不一致
- **缓解**：使用 Tailwind CSS v4，参考 Compass 设计风格，保持简约一致性

## Migration Plan

### 部署步骤
1. 创建应用包目录结构
2. 配置 package.json 和依赖
3. 配置 React Router 和 MDX 插件
4. 创建基础布局和路由组件
5. 集成 Mermaid 渲染组件
6. 编写示例文档和手稿
7. 配置构建脚本，加入 monorepo 构建流程

### 回滚策略
- 删除应用包目录
- 运行 `pnpm install` 更新依赖
- 不影响其他应用

## Open Questions

- 文档内容存放位置：与应用代码同级还是独立内容仓库？
- 是否需要支持 PDF 导出？（后续扩展）
- 是否需要支持暗色模式？（建议支持，与 react-app 保持一致）