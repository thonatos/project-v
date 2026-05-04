## 1. 数据层

- [x] 1.1 更新 `DocFrontmatter` 接口，添加 `tags?: string[]` 字段
- [x] 1.2 更新 `Doc` 接口，添加 `tags: string[]` 字段
- [x] 1.3 修改 `extractFrontmatter` 函数，解析 `tags` 字段（支持 YAML 数组格式）
- [x] 1.4 实现 `getAllTags()` 函数，返回所有标签及其文档数量
- [x] 1.5 实现 `getDocsByTag(tag)` 函数，返回指定标签下的文档列表

## 2. 组件层

- [x] 2.1 创建 `TagBadge` 组件，显示单个标签徽章，支持点击跳转
- [x] 2.2 更新 `ArticleCard` 组件，接收 `tags` 参数并显示标签列表

## 3. 路由层

- [x] 3.1 在 `routes.ts` 中添加 `/tags` 路由
- [x] 3.2 在 `routes.ts` 中添加 `/tags/:tag` 路由
- [x] 3.3 创建 `routes/tags._index.tsx` 标签列表页面
- [x] 3.4 创建 `routes/tags.$tag.tsx` 标签详情页面

## 4. 页面更新

- [x] 4.1 更新 `_index.tsx` 页面，传递 `tags` 到 `ArticleCard` 组件
- [x] 4.2 更新 `docs.$slug.tsx` 页面，在标题下方显示文档标签

## 5. 测试验证

- [x] 5.1 为示例文档添加 `tags` 字段进行测试
- [x] 5.2 验证标签列表页面功能正常
- [x] 5.3 验证标签详情页面功能正常
- [x] 5.4 验证文档列表和详情页标签显示正常
- [x] 5.5 验证标签点击跳转功能正常