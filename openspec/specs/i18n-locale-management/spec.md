# i18n-locale-management Specification

## Purpose
TBD - created by archiving change i18n-studio-locale-management. Update Purpose after archive.
## Requirements
### Requirement: 系统级 locale 字典表

i18n-studio SHALL 维护一张全局 `locales` 表作为多语言字典,所有命名空间引用的语言 code MUST 在该表中已注册。

#### Scenario: 表结构

- **GIVEN** drizzle schema 中 `locales` 表的定义
- **WHEN** 检查列名集合
- **THEN** 至少包含:`code`(PK)、`label`、`englishLabel`、`nativeLabel`、`region`、`isBuiltin`、`enabled`、`sortOrder`、`createdAt`、`updatedAt`

#### Scenario: code 唯一

- **GIVEN** 现有字典已含 `zh-cn`
- **WHEN** 试图再次插入 `zh-cn`
- **THEN** 数据库以 PK 唯一约束拒绝;service 层 `createLocale` 抛 409

### Requirement: 迁移内联默认 12 个内置 locale

drizzle migration **MUST** 在创建 `locales` 表的同一个迁移文件中,以 SQL `INSERT` 的形式注入以下 12 个内置 locale,且 `isBuiltin=1`、`enabled=1`、`sortOrder` 严格递增。

| code | label | englishLabel | nativeLabel | region |
| ---- | ----- | ------------ | ------------ | ------ |
| `zh-cn` | 简体中文 | Simplified Chinese | 中文(简体) | CN |
| `zh-tw` | 繁體中文 | Traditional Chinese | 中文(繁體) | TW |
| `en-us` | 英语 (美国) | English (US) | English | US |
| `en-gb` | 英语 (英国) | English (UK) | English | GB |
| `ja-jp` | 日语 | Japanese | 日本語 | JP |
| `ko-kr` | 韩语 | Korean | 한국어 | KR |
| `fr-fr` | 法语 | French | Français | FR |
| `de-de` | 德语 | German | Deutsch | DE |
| `es-es` | 西班牙语 | Spanish | Español | ES |
| `pt-br` | 葡萄牙语 (巴西) | Portuguese (BR) | Português | BR |
| `ru-ru` | 俄语 | Russian | Русский | RU |
| `ar-sa` | 阿拉伯语 | Arabic | العربية | SA |

#### Scenario: 全新数据库 seed

- **GIVEN** 新建空白 SQLite 数据库
- **WHEN** 应用所有 drizzle migrations
- **THEN** `locales` 表中存在恰好 12 行,code 集合等于上表
- **AND** 所有行 `isBuiltin=1`、`enabled=1`
- **AND** `sortOrder` 按上表顺序严格递增

#### Scenario: seed 不通过应用代码 lazy 创建

- **GIVEN** 应用启动时
- **WHEN** 检查 `app/lib/db.server.ts` 与所有 service 模块
- **THEN** 不存在"若 locales 表为空则插入内置项"的代码;seed 仅由 migration 完成

### Requirement: locale 字典 CRUD 服务

i18n-studio SHALL 提供 `app/lib/services/locale.server.ts`,导出以下函数,语义如下:

- `listLocales(opts?: { enabledOnly?: boolean })`:按 `sortOrder` 升序返回所有/仅启用 locale
- `listEnabledLocales()`:等价 `listLocales({ enabledOnly: true })`
- `getLocale(code)`:返回单条或 `null`
- `createLocale({ code, label, englishLabel, nativeLabel?, region? })`:创建非内置 locale
- `updateLocale(code, patch)`:更新 label / englishLabel / nativeLabel / region(不允许改 code 与 isBuiltin)
- `setEnabled(code, enabled)`:切换 enabled
- `deleteLocale(code)`:删除非内置且无引用项
- `assertLocalesExist(codes)`:全部 code 存在于字典且 `enabled=1`,否则抛带详细信息的错误

#### Scenario: createLocale 成功

- **GIVEN** 字典中尚不存在 `vi-vn`
- **WHEN** 调用 `createLocale({ code: 'vi-vn', label: '越南语', englishLabel: 'Vietnamese' })`
- **THEN** 返回新插入行,`isBuiltin=false`、`enabled=true`、`sortOrder` 大于现有最大值

#### Scenario: createLocale code 已存在

- **GIVEN** 字典中已存在 `zh-cn`
- **WHEN** 调用 `createLocale({ code: 'zh-cn', ... })`
- **THEN** 抛错且不修改数据库

#### Scenario: createLocale code 格式不合法

- **GIVEN** 任意输入 code 不匹配 `localeSchema`(例如 `zh_CN` / `EN-US` / `vi`)
- **WHEN** 调用 `createLocale`
- **THEN** 校验失败,抛错且不写入

#### Scenario: assertLocalesExist 通过 / 失败

- **GIVEN** 字典含 enabled `zh-cn`、disabled `de-de`,无 `xx-yy`
- **WHEN** `assertLocalesExist(['zh-cn'])`
- **THEN** 不抛错
- **AND WHEN** `assertLocalesExist(['xx-yy'])`
- **THEN** 抛错,错误码包含 `locale_not_found`,message 列出 `xx-yy`
- **AND WHEN** `assertLocalesExist(['de-de'])`
- **THEN** 抛错,错误码包含 `locale_disabled`,message 列出 `de-de`

### Requirement: 内置 locale 删除与禁用保护

`isBuiltin=1` 的 locale SHALL NOT 被 `deleteLocale` 删除;但 MAY 通过 `setEnabled(code, false)` 禁用。被任意 namespace 引用的 locale SHALL NOT 被删除或禁用。

#### Scenario: 删除内置 locale

- **GIVEN** `zh-cn` 是内置 locale
- **WHEN** 调用 `deleteLocale('zh-cn')`
- **THEN** 抛 `locale_builtin_undeletable`,数据库未修改

#### Scenario: 删除被引用的非内置 locale

- **GIVEN** 一个 namespace 的 `locales` JSON 含 `vi-vn`,`vi-vn` 是非内置 locale
- **WHEN** 调用 `deleteLocale('vi-vn')`
- **THEN** 抛 `locale_in_use`,错误信息列出引用的 namespace slug
- **AND** 数据库未修改

#### Scenario: 禁用被引用的 locale

- **GIVEN** 一个 namespace 的 `locales` JSON 含 `de-de`
- **WHEN** 调用 `setEnabled('de-de', false)`
- **THEN** 抛 `locale_in_use`,数据库未修改

#### Scenario: 禁用未被引用的内置 locale 成功

- **GIVEN** `ar-sa` 内置且未被任何 namespace 引用
- **WHEN** 调用 `setEnabled('ar-sa', false)`
- **THEN** 字典中 `ar-sa` 行 `enabled=false`,可被 `setEnabled(true)` 还原

### Requirement: locale 管理页

i18n-studio SHALL 提供 `/dashboard/locales` 路由作为系统级 locale 字典管理页,任意已登录用户可读,仅 `user.isSuperuser` 可写。

#### Scenario: 普通用户访问只读

- **GIVEN** 已登录非 superuser 访问 `/dashboard/locales`
- **WHEN** 页面加载完成
- **THEN** 列表显示当前所有字典项
- **AND** 不显示 "Add"、"Edit"、"Disable"、"Delete" 按钮

#### Scenario: superuser 可执行写操作

- **GIVEN** 已登录 superuser
- **WHEN** 通过页面提交创建 / 编辑 / 启停 / 删除请求
- **THEN** 服务端 action 接受并执行;非 superuser 提交同样请求时返回 403

#### Scenario: 页面标题

- **GIVEN** 任意已登录用户访问 `/dashboard/locales`
- **WHEN** 浏览器加载完成
- **THEN** `<title>` 为 `Locales · i18n-studio`

#### Scenario: 禁用 builtin locale 强制二次确认

- **GIVEN** superuser 在 `/dashboard/locales` 列表中点击 builtin locale 行的"禁用"按钮(如 `zh-cn`)
- **WHEN** 视图层处理点击
- **THEN** 不立即提交禁用,而是先打开 `Dialog` 二次确认,文案明确提示"禁用 X 后,新建 namespace 默认会无 X 可选,确认?";仅当用户在 Dialog 中点击"确认"才发起 toggle 请求

### Requirement: locale 多选组件

i18n-studio SHALL 提供 `app/components/locale-multi-select.tsx`,基于 shadcn `Popover` + `Command` 实现,选项来源 SHALL 限定为系统字典中 `enabled=1` 的项,且 SHALL NOT 提供"添加自定义 locale"入口。

#### Scenario: 选项来源限定字典

- **GIVEN** 字典含 enabled 项 12 条 + disabled 项 1 条
- **WHEN** 用户打开多选组件
- **THEN** 列表仅展示 12 个 enabled 项;disabled 项不出现

#### Scenario: 不提供自定义入口

- **GIVEN** 多选组件已打开
- **WHEN** 检查弹层 DOM
- **THEN** 不存在任何允许用户输入并直接添加新 locale code 的输入或按钮(`+ 自定义 locale` 等)
- **AND** 弹层底部包含一段提示文字,引导用户去 `/dashboard/locales` 添加(superuser)或联系管理员(普通用户)

#### Scenario: 已选项以 Badge 展示

- **GIVEN** value=['zh-cn', 'en-us']
- **WHEN** 渲染触发器
- **THEN** 触发器内可见 2 个 Badge,各含 code 与 `×` 按钮,点击 `×` 可单独移除

#### Scenario: 表单序列化

- **GIVEN** 组件 `name="locales"`,value=['zh-cn', 'en-us']
- **WHEN** 表单提交
- **THEN** 表单数据中 `locales` 字段值为字符串 `zh-cn,en-us`

### Requirement: 历史数据修复脚本

i18n-studio SHALL 提供 `app/scripts/repair-locales.ts`,通过 `pnpm -F i18n-studio repair:locales` 触发,默认仅报告字典外 code,`--auto-add` 模式将其入字典。

#### Scenario: 默认模式发现遗留 code 时退出非零

- **GIVEN** 一个数据库中存在 namespace `legacy`,其 `locales` JSON 包含字典里没有的 code `xx-yy`
- **WHEN** 不带参数运行 `repair:locales`
- **THEN** 标准输出列出 `legacy` 与 `xx-yy`
- **AND** 进程以非零退出码结束
- **AND** 数据库未修改

#### Scenario: --auto-add 模式自动入字典

- **GIVEN** 一个数据库中存在 namespace 引用字典外 code `xx-yy`
- **WHEN** 运行 `repair:locales --auto-add`
- **THEN** 字典新增一行 `code='xx-yy', isBuiltin=false, enabled=true`,label/englishLabel 为 `xx-yy` 的占位值
- **AND** 进程以零退出码结束
- **AND** 之后的 `createNamespace` / `updateNamespace` 校验对该 code 通过

#### Scenario: 无遗留 code 时直接通过

- **GIVEN** 所有 namespace 引用的 code 都已存在于字典
- **WHEN** 运行 `repair:locales`(任意模式)
- **THEN** 输出 "No repair needed.",进程以零退出码结束

