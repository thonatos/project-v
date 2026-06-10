## ADDED Requirements

### Requirement: namespace 语种写入路径完整性守卫

所有写入 `namespaces.locales` 的服务路径(创建与更新 namespace)SHALL 在持久化前调用 `assertLocalesExist`,确保引用的每个 locale code 都已存在于字典且 `enabled=1`,从源头杜绝产生「引用字典外 code」的孤儿数据。`namespaces.locales` 的解析 SHALL 收敛到单一工具函数(如 `parseNsLocales`),消除散落多处的重复 `JSON.parse` + `Array.isArray` 防御性代码。

#### Scenario: 创建 namespace 引用字典外 code 被拒

- **GIVEN** 字典中不存在 `xx-yy`
- **WHEN** 以包含 `xx-yy` 的 locales 创建 namespace
- **THEN** 服务层经 `assertLocalesExist` 抛错(`locale_not_found`),namespace 不被创建

#### Scenario: 更新 namespace 引用禁用 code 被拒

- **GIVEN** 字典中 `de-de` 为 disabled
- **WHEN** 把某 namespace 的 locales 更新为包含 `de-de`
- **THEN** 服务层抛错(`locale_disabled`),更新不生效

#### Scenario: 合法写入通过

- **GIVEN** 字典含 enabled `zh-cn`、`en-us`
- **WHEN** 以 `['zh-cn','en-us']` 创建或更新 namespace
- **THEN** 写入成功

#### Scenario: 解析收敛到单一工具

- **GIVEN** 代码库中需要读取 `namespaces.locales` JSON 的位置(如 `listReferencingNamespaces`)
- **WHEN** 检查实现
- **THEN** 它们调用同一个 `parseNsLocales` 工具函数,不再各自内联 `JSON.parse` + `try/catch` + `Array.isArray` 检查

## REMOVED Requirements

### Requirement: 历史数据修复脚本

**Reason**: 该脚本是为补救「`namespaces.locales` 为 JSON 数组、与字典无外键」而设的常驻巡检设施。引入「namespace 语种写入路径完整性守卫」后,孤儿数据无法再产生,巡检设施失去存在意义。历史遗留孤儿数据通过一次性清理处理后,`app/scripts/repair-locales.ts` 与 `repair:locales` npm script 被删除。

**Migration**: 升级时先确保所有写入路径已接入 `assertLocalesExist`,再运行一次性清理处理历史孤儿引用(可复用既有 repair 逻辑跑最后一次),清理完成后删除脚本与 npm script。若部署中曾依赖 `pnpm -F i18n-studio repair:locales`,该命令不再可用;字典引用完整性改由写入守卫在运行时保证,无需定期巡检。
