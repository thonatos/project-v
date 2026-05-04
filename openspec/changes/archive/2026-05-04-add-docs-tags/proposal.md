## Why

目前 docs-app 的文档缺乏分类和组织能力。随着文档数量增长，用户难以快速找到特定主题的文档。添加 tag 功能可以让用户通过标签筛选和浏览文档，提升文档的可发现性和导航体验。

## What Changes

- 文档 frontmatter 新增 `tags` 字段，支持为一个或多个标签
- 新增标签列表页面 `/tags`，展示所有标签及每个标签下的文档数量
- 新增标签详情页面 `/tags/:tag`，展示该标签下的所有文档
- 文档列表页面的 ArticleCard 组件显示文档标签，支持点击跳转
- 文档详情页面显示文档标签，支持点击跳转

## Capabilities

### New Capabilities

- `tags-system`: 标签系统核心功能，包括 frontmatter 解析、标签数据提取、标签路由

### Modified Capabilities

无（这是新功能，不修改现有 spec）

## Impact

- **数据层**: `app/lib/docs.ts` - DocFrontmatter、Doc 接口新增 tags 字段，getAllTags/getDocsByTag 函数
- **路由层**: `app/routes.ts` - 新增 /tags 和 /tags/:tag 路由
- **组件层**: `app/components/article-card.tsx` - 显示标签，`app/components/tag-badge.tsx` - 新增标签徽章组件
- **页面层**: `app/routes/_index.tsx` - 传递 tags 到 ArticleCard，`app/routes/docs.$slug.tsx` - 显示标签
- **新建页面**: `app/routes/tags._index.tsx` - 标签列表页，`app/routes/tags.$tag.tsx` - 标签详情页

## Rollback Plan

1. 删除新增的路由文件 `routes/tags._index.tsx` 和 `routes/tags.$tag.tsx`
2. 删除新增的组件 `components/tag-badge.tsx`
3. 回滚 `routes.ts` 中新增的路由配置
4. 回滚 `docs.ts` 中新增的 tags 相关代码
5. 回滚 `article-card.tsx` 和 `docs.$slug.tsx` 中的标签显示代码
6. 标签为可选字段，现有文档无需修改，回滚不影响现有功能