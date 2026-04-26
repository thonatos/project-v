## Why

需要一个专门的文档和手稿存放平台，用于整理技术文档、写作手稿等内容。当前项目已有多个应用（react-app、artusx-api 等），但缺少一个专注于内容展示的静态文档站点。采用 MDX 格式可以在 Markdown 中嵌入 React 组件，提供更丰富的交互体验。

## What Changes

- 新增 `docs-app` 应用包，使用 React Router v7 + MDX 构建
- 采用约定式文件路由，参考现有 `react-app` 的路由配置方式
- 界面设计参考 Tailwind CSS Compass 风格：简约单列布局，以内容为核心，无复杂侧边栏
- 支持 Mermaid 流程图渲染，用于展示技术架构图和流程图
- 集成 Tailwind CSS v4 样式系统，支持亮色/暗色模式自适应

## Capabilities

### New Capabilities

- `mdx-content`: MDX 文档内容处理与渲染，支持 Markdown + React 组件混合编写
- `file-routing`: 约定式文件路由系统，基于文件结构自动生成路由配置
- `mermaid-diagrams`: Mermaid 流程图渲染支持，用于技术架构图和流程图展示
- `docs-ui`: 文档站点界面设计，参考 Compass 风格，简约单列布局

## Impact

- 新增应用包目录：`packages/apps/docs-app/`
- 修改 `pnpm-workspace.yaml`，添加新包路径（已包含 packages/apps/*）
- 依赖 React Router v7、MDX 相关包、Mermaid 渲染库、Tailwind CSS v4
- 不影响现有应用，纯新增功能

## Rollback Plan

如需回滚：
1. 删除 `packages/apps/docs-app/` 目录
2. 从根目录 `package.json` 移除相关依赖（如有）
3. 运行 `pnpm install` 更新依赖锁文件