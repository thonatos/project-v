## Why

当前 docs-app 使用 `marked` 处理 Markdown 文件，功能相对基础。用户需要更强大的文档处理能力：
- **Remark** 是更成熟的 Markdown 处理生态，支持丰富的插件系统
- **TOC** 功能缺失，用户无法快速导航长文档
- **流程图** 等图表功能需要完善，当前 mermaid 支持不完整
- **文档页面布局** 不够宽敞，未充分利用屏幕空间

改进这些功能可以提升文档站点的用户体验和内容展示能力。

## What Changes

- 使用 **remark + rehype** 替换 marked，统一 Markdown 处理生态
- 添加 **TOC（目录）** 组件，支持长文档导航
- 完善 **Mermaid 流程图** 支持，确保图表正确渲染
- 优化 **文档页面布局**，使其铺满屏幕，提升阅读体验
- 添加 **remark 插件**：remark-gfm（GitHub Flavored Markdown）、remark-frontmatter（YAML 解析）

## Capabilities

### New Capabilities

- `docs-remark-processing`: 使用 remark/rehype 处理 Markdown，支持插件扩展
- `docs-toc-navigation`: 文档目录导航组件，支持标题层级跳转
- `docs-full-width-layout`: 文档页面全屏宽度布局

### Modified Capabilities

- `mermaid-diagrams`: 扩展 mermaid 流程图支持，确保与 remark 兼容
- `docs-ui`: 修改文档页面布局规格，改为全屏宽度

## Impact

**Affected Files:**
- `packages/apps/docs-app/app/lib/docs.ts` - 重构为 remark 处理
- `packages/apps/docs-app/app/components/toc.tsx` - 完善 TOC 组件
- `packages/apps/docs-app/app/routes/docs.$slug.tsx` - 添加 TOC 和布局优化
- `packages/apps/docs-app/package.json` - 添加 remark 相关依赖

**Dependencies Added:**
- `remark`
- `remark-gfm`
- `remark-frontmatter`
- `remark-html`
- `rehype-highlight`（可选，代码高亮）

**Dependencies Removed:**
- `marked`

**Breaking Changes:**
- 无。remark 的输出格式与 marked 兼容，用户无感知。

**Rollback Plan:**
如有问题，可回滚到 marked 版本。保留原有 docs.ts 逻辑作为备份。