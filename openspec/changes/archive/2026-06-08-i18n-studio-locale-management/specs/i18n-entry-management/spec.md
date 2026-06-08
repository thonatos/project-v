## MODIFIED Requirements

### Requirement: 默认与可扩展语言配置

系统 SHALL 维护一张全局 locale 字典(参见 capability `i18n-locale-management`),命名空间的语言列表 MUST 仅引用字典中 `enabled=1` 的 code。新建命名空间且未显式提供 `locales` 时,系统 SHALL 取字典中按 `sortOrder` 升序排列的前三个 enabled 内置 locale 作为默认值(默认情况下等价于 `zh-cn`、`zh-tw`、`en-us`)。所有语言代码 MUST 满足 BCP-47 风格的小写 `xx` 或 `xx-xx` 格式。

#### Scenario: 命名空间默认语言

- **GIVEN** 新创建的命名空间且 `locales` 入参为空
- **WHEN** 查询其语言列表
- **THEN** 返回字典中前三个 enabled 内置 locale 的 code(默认部署等于 `["zh-cn","zh-tw","en-us"]`),并标记其首项(`zh-cn`)为 `default_locale`(用于翻译任务的源语言默认值与 UI 元信息提示,不影响运行时缺失值的填充行为)

#### Scenario: 添加新语言到命名空间

- **GIVEN** 命名空间管理员,且字典中存在 enabled `ja-jp`
- **WHEN** 通过 `updateNamespace` 提交追加 `ja-jp`
- **THEN** 系统校验通过并将其加入命名空间语言列表

#### Scenario: 拒绝字典外语言代码

- **GIVEN** 输入语言代码 `xx-yy`,字典中不存在该 code
- **WHEN** 用户提交 `createNamespace` 或 `updateNamespace`
- **THEN** 系统返回 422,错误码 `locale_not_found`,不修改数据库

#### Scenario: 拒绝已禁用的语言代码

- **GIVEN** 字典中 `de-de` 存在但 `enabled=0`
- **WHEN** 用户在 `createNamespace` / `updateNamespace` 中引用 `de-de`
- **THEN** 系统返回 422,错误码 `locale_disabled`,不修改数据库

#### Scenario: 拒绝格式非法的语言代码

- **GIVEN** 输入语言代码 `Chinese` 或 `zh_CN`
- **WHEN** 用户提交配置
- **THEN** 系统返回校验错误,要求使用 `xx` 或 `xx-xx` 小写格式(此校验在字典查询之前进行,因此即使字典含同名条目也无法绕过格式约束)

#### Scenario: default_locale 必须在已选 locales 中

- **GIVEN** namespace 当前 `locales=['zh-cn','en-us']`,`default_locale='zh-cn'`
- **WHEN** 用户提交 `updateNamespace({ defaultLocale: 'ja-jp' })`(`ja-jp` 不在 locales 列表)
- **THEN** 系统返回 422,提示 `default_locale 必须在 locales 列表中`,不修改数据库
