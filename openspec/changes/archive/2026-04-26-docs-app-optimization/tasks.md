## 1. 移除 MDX 相关配置

- [x] 1.1 从 `package.json` 移除 MDX 相关依赖（`@mdx-js/react`, `@mdx-js/rollup`, `remark-frontmatter`, `remark-mdx-frontmatter`）
- [x] 1.2 从 `vite.config.ts` 移除 MDX 插件配置
- [x] 1.3 移除现有的 MDX 文件和 MDX 组件（`mdx-components.tsx`）
- [x] 1.4 安装 Markdown 解析依赖（`marked` 或类似库）

## 2. 文档存储目录配置

- [x] 2.1 创建 `app/docs/` 目录
- [x] 2.2 创建示例文档文件（含 YAML frontmatter）

## 3. 文档读取模块

- [x] 3.1 创建 `app/lib/docs.ts` 文档读取模块
- [x] 3.2 实现 `getDocSlugs()` - 读取 `app/docs` 目录返回 slug 列表
- [x] 3.3 实现 `getDocBySlug(slug)` - 读取单个文档，解析 frontmatter + Markdown
- [x] 3.4 实现 Markdown → HTML 渲染（含 Shiki 语法高亮）
- [x] 3.5 实现 `getAllDocs()` - 返回所有文档列表（含 frontmatter）

## 4. React Router SSG 配置

- [x] 4.1 配置 `react-router.config.ts`：`ssr: false` + `prerender` 函数
- [x] 4.2 在 `prerender()` 中调用 `getDocSlugs()` 生成预渲染路径列表
- [x] 4.3 验证 `pnpm build` 生成静态 HTML

## 5. 站点标题和描述配置

- [x] 5.1 更新站点标题为 "ρV"，描述为 "undefined project"
- [x] 5.2 更新导航栏 Logo 显示为 "ρV"
- [x] 5.3 配置页面 meta 标签

## 6. 首页路由

- [x] 6.1 创建首页 loader，调用 `getAllDocs()` 获取文档列表
- [x] 6.2 重构首页，展示文档卡片列表
- [x] 6.3 实现文档卡片网格布局（桌面端 2 列，移动端单列）
- [x] 6.4 添加 Hero 区域（标题 "ρV" + 描述 "undefined project")

## 7. 导航栏简化

- [x] 7.1 导航栏仅保留 Logo "ρV" 和主题切换

## 8. Footer 内容优化

- [x] 8.1 在 Footer 添加版权声明
- [x] 8.2 在 Footer 添加 GitHub 链接
- [x] 8.3 优化 Footer 样式

## 9. 文档详情页路由

- [x] 9.1 创建 `app/routes/docs.$slug.tsx` 动态路由
- [x] 9.2 实现 loader：调用 `getDocBySlug(params.slug)` 获取文档数据
- [x] 9.3 实现文档内容渲染（标题、段落、代码块样式）
- [x] 9.4 实现 frontmatter meta 标签（title、description）

## 10. 测试与验证

- [x] 10.1 验证开发环境 `pnpm dev` loader 正常执行
- [x] 10.2 验证开发环境热更新功能
- [x] 10.3 验证 `pnpm build` 生成静态站点
- [x] 10.4 验证静态站点包含首页和所有文档详情页
- [x] 10.5 验证静态站点可部署到 Cloudflare Pages/GitHub Pages