## ADDED Requirements

### Requirement: 统一标签常量导出
`docs.ts` SHALL 导出 `TECH_TAGS` 和 `TRADING_TAGS` 两个只读数组，分别包含技术类和交易类标签的完整列表。

### Requirement: 标签分类工具函数
`docs.ts` SHALL 导出 `isTechTag(tag: string): boolean` 和 `isTradingTag(tag: string): boolean` 两个函数，用于判断给定标签是否属于对应分类。

#### Scenario: 判断技术标签
- **GIVEN** 调用 `isTechTag('linux')`
- **WHEN** 系统判断
- **THEN** 返回 `true`

#### Scenario: 判断非技术标签
- **GIVEN** 调用 `isTechTag('trading')`
- **WHEN** 系统判断
- **THEN** 返回 `false`

#### Scenario: 判断交易标签
- **GIVEN** 调用 `isTradingTag('investment')`
- **WHEN** 系统判断
- **THEN** 返回 `true`

### Requirement: 路由使用统一标签
`tech._index.tsx` SHALL 从 `~/lib/docs` 导入 `TECH_TAGS` 常量，不再在文件内部硬编码定义。`trading._index.tsx` 同理导入 `TRADING_TAGS`。

#### Scenario: tech 路由使用导入的标签
- **GIVEN** `tech._index.tsx` 从 `~/lib/docs` 导入 `TECH_TAGS`
- **WHEN** 页面加载时筛选文档
- **THEN** 使用导入的 `TECH_TAGS` 进行过滤

#### Scenario: trading 路由使用导入的标签
- **GIVEN** `trading._index.tsx` 从 `~/lib/docs` 导入 `TRADING_TAGS`
- **WHEN** 页面加载时筛选文档
- **THEN** 使用导入的 `TRADING_TAGS` 进行过滤
