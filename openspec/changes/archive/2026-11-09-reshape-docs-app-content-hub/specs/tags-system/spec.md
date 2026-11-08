# Spec Delta

## REMOVED Requirements

### Requirement: 获取所有标签

**Reason**: Tags 降级为非导航元数据，站点不再维护面向页面的全量标签聚合。

**Migration**: Docs 使用分类目录，Blog 使用稳定栏目；内容仍可保留 `tags` frontmatter 供未来搜索或关联能力使用。

### Requirement: 获取标签下的文档

**Reason**: 标签不再作为读者筛选内容的公开维度。

**Migration**: 通过 `/docs` 分类和 `/blog` 栏目发现内容。

### Requirement: 标签列表页面

**Reason**: `/tags` 的高基数低复用标签无法形成有效导航。

**Migration**: 旧 `/tags` 地址迁移到 `/blog`；一级导航改为 Docs、Blog、Projects。

### Requirement: 标签详情页面

**Reason**: 标签详情页随标签导航体系下线。

**Migration**: 旧 `/tags/:tag` 地址迁移到 `/blog`，读者改用 Blog 栏目或 Docs 分类。

### Requirement: 文档列表显示标签

**Reason**: 卡片上的大量标签削弱标题、摘要和稳定分类的层级。

**Migration**: Docs 列表显示文档分类，Blog 列表显示文章栏目；列表不再提供标签链接。

### Requirement: 文档详情页显示标签

**Reason**: 详情页不再通过标签把用户导向已下线的聚合页面。

**Migration**: Docs 详情保留分类上下文，Blog 详情显示稳定栏目；原始 `tags` 元数据无需从 Markdown 立即删除。
