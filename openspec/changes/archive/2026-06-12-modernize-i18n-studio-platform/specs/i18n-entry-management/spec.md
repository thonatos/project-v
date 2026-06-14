## MODIFIED Requirements

### Requirement: 多视图词条查询

系统 SHALL 提供按命名空间为根的词条查询，支持以下组合：（a）返回所有启用语言；（b）按一个或多个 `locale` 过滤；（c）按 release `bundle_version` 快照。带 `bundle_version` 的快照 MUST 基于 release manifest 计算，而不是把 namespace 级 bundle version 当作单条翻译的局部 version。所有视图 MUST 保持响应结构一致：词条以 flat key 列表返回，每项包含 `key` 与 `translations: { [locale]: { value, version, missing? } }`。

#### Scenario: 按空间获取所有语言

- **GIVEN** 命名空间启用 `zh-cn / zh-tw / en-us`，含若干词条
- **WHEN** 调用 `GET /api/.../entries?view=all`
- **THEN** 每条词条返回三个 locale 的 `value` 与 `version`，缺失 locale 标记 `missing: true` 且 `value=""`

#### Scenario: 按特定单一语言

- **GIVEN** 命名空间含若干词条
- **WHEN** 调用 `GET /api/.../entries?locale=zh-cn`
- **THEN** 每条词条仅返回 `translations.zh-cn`，未启用 / 缺失情况下仍按 missing 语义返回

#### Scenario: 按多语言子集

- **GIVEN** 命名空间启用 `zh-cn / zh-tw / en-us / ja-jp`
- **WHEN** 调用 `GET /api/.../entries?locale=zh-cn,en-us`
- **THEN** 响应仅包含 `zh-cn` 与 `en-us` 两个 locale 字段，不含其它

#### Scenario: 拒绝未启用 locale

- **GIVEN** 命名空间未启用 `de-de`
- **WHEN** 查询参数 `locale=de-de`
- **THEN** 系统返回 422，提示 locale 未启用

#### Scenario: 按 release 快照获取（全空间）

- **GIVEN** 命名空间存在 `bundle_version=12` 的 release manifest
- **WHEN** 调用 `GET /api/.../entries?bundle_version=12&locale=zh-cn`
- **THEN** 返回值来自 release manifest 指向的 translation version，而不是 `translation_versions.version <= 12` 的推算结果

#### Scenario: release 快照与多语言组合

- **GIVEN** release manifest 记录了同一词条 `zh-cn` version 5 与 `en-us` version 3
- **WHEN** 调用 `?bundle_version=12&locale=zh-cn,en-us`
- **THEN** `zh-cn` 返回 manifest 指向的 version 5，`en-us` 返回 manifest 指向的 version 3

#### Scenario: release 快照中的尚未存在

- **GIVEN** 词条 `home.subtitle` 未出现在 `bundle_version=12` 的 release manifest 中
- **WHEN** 按 `bundle_version=12` 查询
- **THEN** 该词条不出现在结果中，不以 missing 形式返回

#### Scenario: flat 导出按 release 快照

- **GIVEN** 命名空间含若干词条与 release manifest
- **WHEN** 调用 `GET /api/.../export?locale=zh-cn&bundle_version=12`
- **THEN** 返回 `{ "home.title": "<manifest 指向的值>", ... }`，不包含 manifest 之外的条目

#### Scenario: bundle_version 与 view=all 同时存在

- **GIVEN** 命名空间含三种语言且存在 release manifest
- **WHEN** 调用 `?view=all&bundle_version=20`
- **THEN** 每条词条按 manifest 中各自语言的 translation version 返回，三种语言都各自标记 `value/version/missing`

#### Scenario: legacy at_version 兼容

- **GIVEN** 客户端仍调用旧参数 `at_version`
- **WHEN** 系统尚未移除兼容层
- **THEN** 系统 MUST 将其映射到明确文档化的 legacy 行为或返回带迁移提示的 422，MUST NOT 悄悄产生与 release 语义冲突的结果
