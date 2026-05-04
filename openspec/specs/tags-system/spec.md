## ADDED Requirements

### Requirement: Tags 字段解析

系统 SHALL 从文档 Markdown frontmatter 中解析 `tags` 字段，支持 YAML 数组格式。

#### Scenario: 单标签解析
- **GIVEN** 文档 frontmatter 包含 `tags: [react]`
- **WHEN** 系统解析文档
- **THEN** 文档数据包含 `tags: ['react']`

#### Scenario: 多标签解析
- **GIVEN** 文档 frontmatter 包含 `tags: [react, typescript, frontend]`
- **WHEN** 系统解析文档
- **THEN** 文档数据包含 `tags: ['react', 'typescript', 'frontend']`

#### Scenario: 无标签字段
- **GIVEN** 文档 frontmatter 不包含 `tags` 字段
- **WHEN** 系统解析文档
- **THEN** 文档数据包含 `tags: []`

#### Scenario: 空标签数组
- **GIVEN** 文档 frontmatter 包含 `tags: []`
- **WHEN** 系统解析文档
- **THEN** 文档数据包含 `tags: []`

### Requirement: 获取所有标签

系统 SHALL 提供 `getAllTags()` 函数，返回所有文档中出现的标签及其文档数量。

#### Scenario: 获取标签列表
- **GIVEN** 存在多个文档包含不同标签
- **WHEN** 调用 `getAllTags()`
- **THEN** 返回标签数组，每个标签包含 `name` 和 `count` 字段，按文档数量降序排列

#### Scenario: 无文档时获取标签
- **GIVEN** 文档目录为空
- **WHEN** 调用 `getAllTags()`
- **THEN** 返回空数组

### Requirement: 获取标签下的文档

系统 SHALL 提供 `getDocsByTag(tag)` 函数，返回包含指定标签的所有文档。

#### Scenario: 获取特定标签的文档
- **GIVEN** 存在多个文档包含标签 `react`
- **WHEN** 调用 `getDocsByTag('react')`
- **THEN** 返回包含 `react` 标签的文档数组，按日期降序排列

#### Scenario: 标签不存在
- **GIVEN** 没有任何文档包含标签 `unknown`
- **WHEN** 调用 `getDocsByTag('unknown')`
- **THEN** 返回空数组

### Requirement: 标签列表页面

系统 SHALL 在 `/tags` 路径提供标签列表页面，展示所有标签及每个标签下的文档数量。

#### Scenario: 访问标签列表页
- **GIVEN** 存在多个标签
- **WHEN** 用户访问 `/tags`
- **THEN** 页面展示所有标签，每个标签显示名称和文档数量，可点击跳转到标签详情页

#### Scenario: 无标签时访问列表页
- **GIVEN** 没有任何标签
- **WHEN** 用户访问 `/tags`
- **THEN** 页面显示"暂无标签"提示

### Requirement: 标签详情页面

系统 SHALL 在 `/tags/:tag` 路径提供标签详情页面，展示该标签下的所有文档列表。

#### Scenario: 访问标签详情页
- **GIVEN** 标签 `react` 下有 3 篇文档
- **WHEN** 用户访问 `/tags/react`
- **THEN** 页面展示标签名称和 3 篇文档列表，每篇文档可点击跳转到详情页

#### Scenario: 访问空标签详情页
- **GIVEN** 标签 `unknown` 下没有文档
- **WHEN** 用户访问 `/tags/unknown`
- **THEN** 页面展示标签名称和"暂无文档"提示

### Requirement: 文档列表显示标签

系统 SHALL 在文档列表页的每个文档卡片上显示该文档的标签，标签可点击跳转到对应标签详情页。

#### Scenario: 文档卡片显示标签
- **GIVEN** 文档包含标签 `react` 和 `typescript`
- **WHEN** 用户查看文档列表页
- **THEN** 该文档卡片显示两个标签徽章，点击标签跳转到对应标签详情页

#### Scenario: 文档无标签时不显示
- **GIVEN** 文档不包含任何标签
- **WHEN** 用户查看文档列表页
- **THEN** 该文档卡片不显示标签区域

### Requirement: 文档详情页显示标签

系统 SHALL 在文档详情页显示该文档的标签，标签可点击跳转到对应标签详情页。

#### Scenario: 文档详情页显示标签
- **GIVEN** 文档包含标签 `react` 和 `typescript`
- **WHEN** 用户查看文档详情页
- **THEN** 页面在标题下方显示两个标签徽章，点击标签跳转到对应标签详情页

#### Scenario: 文档无标签时不显示
- **GIVEN** 文档不包含任何标签
- **WHEN** 用户查看文档详情页
- **THEN** 页面不显示标签区域