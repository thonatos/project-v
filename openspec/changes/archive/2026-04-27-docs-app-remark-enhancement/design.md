## Context

当前 docs-app 使用 `marked` 库处理 Markdown 文件，功能相对基础：
- 仅支持基本的 Markdown 语法解析
- 代码高亮通过自定义 renderer 实现，不够灵活
- 缺少 TOC（目录）生成能力
- Mermaid 流程图支持不完整
- 文档页面布局使用 `max-w-3xl` 限制宽度，不够宽敞

**目标改进：**
- 切换到 remark/rehype 生态，获得更丰富的插件支持
- 实现 TOC 导航功能
- 完善 Mermaid 流程图
- 优化文档页面布局，使其铺满屏幕

## Goals / Non-Goals

**Goals:**
- 使用 remark + rehype 替换 marked
- 实现完整的 TOC 目录导航
- 支持 GFM（GitHub Flavored Markdown）
- 完善 Mermaid 流程图渲染
- 文档页面全屏宽度布局

**Non-Goals:**
- 不添加搜索功能
- 不添加评论/反馈功能
- 不改变 Markdown 文件存储结构（仍使用 `app/docs/`）

## Decisions

### 1. Markdown 处理库选择

**决策：** 使用 unified + remark + rehype 生态系统

**替代方案：**
- `marked`：功能基础，插件生态有限
- `markdown-it`：功能强大，但插件生态不如 unified
- `mdast`（直接使用）：需要手动组装处理流程

**理由：**
- unified 是最成熟的 Markdown 处理框架
- remark 插件丰富（remark-gfm、remark-toc 等）
- rehype 支持 HTML 转换和代码高亮
- 与 React Router v7 SSG 架构兼容

### 2. TOC 实现方式

**决策：** 服务端生成 TOC 数据，客户端渲染组件

**替代方案：**
- 纯客户端生成：需要 DOM 操作，与 SSG 不兼容
- 使用 remark-toc 自动插入：TOC 在文档内容中，不够灵活

**理由：**
- TOC 作为独立组件，可放置在侧边栏
- 服务端生成确保 SSG 预渲染兼容
- 灵活控制 TOC 展示样式和位置

### 3. 代码高亮方案

**决策：** 使用 rehype-highlight 插件

**替代方案：**
- 自定义 CSS 样式：当前方案，不够灵活
- Shiki：功能强大，但 SSR 兼容性复杂

**理由：**
- rehype-highlight 使用 highlight.js，与当前方案一致
- 作为 rehype 插件，与 unified 流程集成
- 服务端预渲染，客户端零开销

### 4. 文档页面布局

**决策：** 移除 max-w-3xl 限制，使用全屏宽度 + 内容居中

**替代方案：**
- 保持固定宽度：阅读体验好，但不充分利用屏幕
- 响应式宽度：复杂度高，维护成本

**理由：**
- 全屏宽度更符合现代文档站点设计
- 内容区域保持适当边距（px-4 sm:px-6 lg:px-8）
- TOC 侧边栏可利用额外空间

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                      docs.ts (remark 处理)                     │
│                                                               │
│  Markdown File ──► remark-parse ──► remark-gfm               │
│                  ──► remark-frontmatter ──► extract TOC       │
│                  ──► remark-html ──► rehype-highlight         │
│                  ──► HTML Output                              │
└                                                               │
│  Output: { title, date, description, content, toc }          │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                 docs.$slug.tsx (文档详情页)                    │
│                                                               │
│  ┌──────────────────────┬────────────────────────────────┐   │
│  │   TOC Sidebar        │      Article Content          │   │
│  │   (sticky)           │      (full-width)             │   │
│  │                      │                               │   │
│  │   - Heading 1        │  ┌─────────────────────────┐ │   │
│  │   - Heading 2        │  │ Header (title + date)   │ │   │
│  │     - Heading 3      │  └─────────────────────────┘ │   │
│  │                      │                               │   │
│  │                      │  ┌─────────────────────────┐ │   │
│  │                      │  │ Markdown Content        │ │   │
│  │                      │  │ (prose + mermaid)       │ │   │
│  │                      │  └─────────────────────────┘ │   │
│  └──────────────────────┴────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| remark 处理性能可能不如 marked | remark 同样高效，且服务端预渲染，客户端无影响 |
| rehype-highlight 与当前 CSS 样式冲突 | 使用相同的 CSS 变量，确保样式一致 |
| 全屏布局在移动端体验不佳 | 保持响应式设计，移动端隐藏 TOC 侧边栏 |
| Mermaid 客户端渲染可能导致闪烁 | 使用 mermaid-cli 预渲染，或客户端异步加载 |

## Migration Plan

**步骤：**
1. 安装 remark 相关依赖（remark、remark-gfm、remark-frontmatter、rehype-highlight）
2. 重构 docs.ts 使用 remark 处理 Markdown
3. 实现 TOC 提取逻辑
4. 完善 TOC 组件
5. 修改 docs.$slug.tsx 布局（全屏宽度 + TOC 侧边栏）
6. 完善 Mermaid 渲染
7. 移除 marked 依赖
8. 测试验证

**回滚策略：**
保留原有 marked 版本的 docs.ts 作为备份分支。如遇问题可快速切换。