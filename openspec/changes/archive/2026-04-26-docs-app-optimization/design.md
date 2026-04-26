## Context

docs-app 是一个基于 React Router v7 的文档站点。站点标题为 "ρV"，描述为 "undefined project"。当前使用 MDX 格式管理内容，需要简化为普通 Markdown 文档 + 双模式渲染架构。

技术栈：
- React Router v7 + React 19（支持 SSG）
- Tailwind CSS v4
- Shiki 语法高亮
- next-themes 主题管理

## Goals / Non-Goals

**Goals:**

- 更新站点标题为 "ρV"，描述为 "undefined project"
- 移除 MDX，简化内容管理
- 文档存储在 `app/docs` 目录
- **开发环境**：提供 API 读取文档，动态渲染页面
- **生产部署**：脚本读取 docs 生成数据，SSG 预渲染生成静态站点
- 首页展示 docs 文档列表
- 导航栏 Logo 显示为 "ρV"
- Footer 优化内容结构

**Non-Goals:**

- 不引入搜索功能
- 不添加评论系统

## Decisions

### 文档存储方案

**选择：`app/docs` 目录 + 普通 Markdown**

文档存储在 `packages/apps/docs-app/app/docs/` 目录下，每个文档文件使用 YAML frontmatter 格式存储元数据（title, date, description）。

### 双模式渲染架构

**选择：开发环境动态渲染 + 生产环境 SSG 预渲染**

#### 开发环境流程（DEV）

```mermaid
flowchart TB
    subgraph Dev["开发环境 (pnpm dev)"]
        A1[启动开发服务器] --> A2[React Router Dev Server]
        A2 --> A3{用户访问页面}
        
        A3 -->|首页 "/"| B1[首页 loader 执行]
        A3 -->|详情页 "/docs/:slug"| B2[详情页 loader 执行]
        
        B1 --> C1[调用 getDocSlugs]
        B2 --> C2[调用 getDocBySlug]
        
        C1 --> D1[读取 app/docs 目录]
        C2 --> D2[读取 app/docs/:slug.md]
        
        D1 --> E1[解析所有文档 frontmatter]
        D2 --> E2[解析 frontmatter + Markdown]
        
        E1 --> F1[返回文档列表数据]
        E2 --> F2[返回文档详情 + HTML]
        
        F1 --> G1[页面动态渲染]
        F2 --> G2[页面动态渲染]
        
        G1 --> H1[显示文档卡片列表]
        G2 --> H2[显示文档内容 + 代码高亮]
        
        note1["热更新: 修改文档 → 页面自动刷新"]
    end
```

**开发环境特点：**
- loader 在请求时执行，数据实时获取
- 修改文档即刻生效，支持热更新
- 使用 React Router 开发服务器，无需单独 API 路由

#### 生产环境流程（PROD）

```mermaid
flowchart TB
    subgraph Build["构建阶段 (pnpm build)"]
        direction TB
        A1[执行构建脚本] --> A2[读取 app/docs 目录]
        A2 --> A3[遍历所有 .md 文件]
        A3 --> A4[解析 frontmatter + Markdown]
        A4 --> A5[Shiki 代码高亮处理]
        A5 --> A6[生成文档数据 JSON]
        A6 --> A7[生成预渲染路径列表]
        
        A7 --> B1[配置 SSG 预渲染]
        B1 --> B2[React Router SSG Build]
        B2 --> B3[预渲染首页 "/"]
        B2 --> B4[预渲染详情页 "/docs/:slug"]
        
        B3 --> C1[生成 index.html]
        B4 --> C2[生成 docs/:slug/index.html]
        
        C1 --> D1[静态站点产物]
        C2 --> D1
    end
    
    subgraph Deploy["部署阶段"]
        D1 --> E1[上传至静态托管平台]
        E1 --> E2[Cloudflare Pages / GitHub Pages]
        E2 --> E3[用户访问静态 HTML]
        E3 --> E4[无需 API，直接返回页面]
    end
```

**生产环境特点：**
- 构建阶段预生成所有页面
- 最终产物为纯静态 HTML + CSS + JS
- 部署无需服务器运行时
- 用户访问时无需 API 调用，加载更快

**理由：**
- 开发环境动态渲染支持实时预览和热更新，提升开发体验
- 生产环境 SSG 预渲染生成静态站点，无需服务器运行时，部署简单
- React Router v7 内置 SSG 支持，实现简单

### 构建脚本流程

**选择：`react-router.config.ts` + prerender 配置**

React Router v7 内置 SSG 支持，通过 `react-router.config.ts` 配置预渲染：

```typescript
// react-router.config.ts
import type { Config } from '@react-router/dev/config';
import { getDocSlugs } from './scripts/get-docs';

export default {
  ssr: false, // 禁用运行时服务器渲染
  async prerender() {
    // 读取 app/docs 目录获取所有文档 slug
    const slugs = await getDocSlugs();
    return [
      '/',           // 首页
      ...slugs.map((slug) => `/docs/${slug}`), // 文档详情页
    ];
  },
} satisfies Config;
```

**关键配置说明：**
- `ssr: false` - 禁用 SSR，生成纯静态站点
- `prerender` - 返回需要预渲染的 URL 路径列表
- 动态路由 `/docs/:slug` 需要手动指定所有 slug 值
- loader 函数在构建时执行，数据直接嵌入静态 HTML

**loader 数据加载：**
```typescript
// app/routes/docs.$slug.tsx
import type { Route } from './+types/docs.$slug';

export async function loader({ params }: Route.LoaderArgs) {
  const doc = await getDocBySlug(params.slug);
  return doc;
}

export default function DocPage({ loaderData }: Route.ComponentProps) {
  return <article>{loaderData.content}</article>;
}
```

**理由：**
- React Router v7 官方 SSG 方案，无需额外工具
- loader 函数在构建时执行，数据自动嵌入页面
- 开发环境和生产环境使用相同的 loader，代码一致

### Markdown 渲染方案

**选择：Shiki 语法高亮 + Markdown 解析**

- 使用 Shiki 进行代码块语法高亮
- 使用轻量 Markdown 解析库（如 `marked`）渲染内容

**理由：**
- 项目已集成 Shiki，可复用
- Markdown 解析比 MDX 更简单

### 首页布局方案

**选择：文档列表 + 卡片网格**

首页展示 docs 文档列表，使用卡片网格布局。

### 导航栏结构

**选择：ρV Logo + 主题切换**

导航栏布局：
```
[ρV]                                          [主题切换]
```

## Risks / Trade-offs

**风险：SSG 构建时间随文档数量增长**
→ 缓解：文档数量有限，构建时间可控

**风险：开发环境 API 和生产环境 SSG 数据源可能不一致**
→ 缓解：两者都读取相同的 `app/docs` 目录，数据源一致

**风险：移除 MDX 后无法嵌入 React 组件**
→ 缓解：文档场景通常不需要复杂组件交互，普通 Markdown 已足够