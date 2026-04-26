## Why

docs-app 的布局和发布流程需要优化以提升用户体验和开发效率。当前使用 MDX 格式管理内容，复杂度较高；站点标题和描述需要更新为 "ρV" 和 "undefined project"；需要简化内容管理和渲染架构。

## What Changes

- **站点标题和描述**：更新站点标题为 "ρV"，描述为 "undefined project"
- **移除 MDX**：移除 MDX 相关依赖和配置，改用普通 Markdown 文档
- **文档存储位置**：将文档放在 `packages/apps/docs-app/app/docs` 目录
- **开发环境**：提供 API 读取 `app/docs` 目录，动态渲染文档页面
- **生产部署**：脚本读取 docs 生成文档数据，SSG 预渲染所有页面为静态站点
- **首页布局优化**：展示 docs 文档列表
- **导航栏增强**：Logo 显示为 "ρV"
- **Footer 内容优化**：添加版权声明和外部链接

## Capabilities

### New Capabilities

- `docs-home-layout`: 首页布局优化，展示 docs 文档列表
- `docs-api`: 开发环境的文档 API 服务，读取 `app/docs` 目录返回文档数据
- `docs-ssg`: 生产部署的 SSG 预渲染流程，脚本读取 docs 生成静态站点

### Modified Capabilities

- `docs-ui`: 更新站点标题为 "ρV"，调整导航栏和 Footer
- `file-routing`: 改为动态路由，路由路径由文档数据决定

### Removed Capabilities

- `mdx-content`: 移除 MDX 内容解析和渲染能力

## Impact

- **Removed dependencies**: `@mdx-js/react`, `@mdx-js/rollup`, `remark-frontmatter`, `remark-mdx-frontmatter`
- **New files**: API 路由文件、SSG 构建脚本、文档存储目录 `app/docs/`
- **Architecture**: 开发环境 API + 动态渲染，生产环境脚本 + SSG 预渲染