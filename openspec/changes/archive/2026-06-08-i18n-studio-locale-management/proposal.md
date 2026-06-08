## Why

当前命名空间的语言列表完全由用户自由文本输入(`zh-cn,zh-tw,en-us`),并且 `localeSchema` 只做 BCP-47 风格校验,这带来两个问题:

1. **手动输入易错**:逗号、大小写、漏字符,常见的拼写错误(`zh-CN`、`en_US`)直到 `slugSchema` 报错才暴露;校验过但拼错的(如 `en-uk`)能直接落库,后续无法纠正
2. **缺少"系统级语言字典"**:每个命名空间各自存一份 `JSON.stringify(locales)`,没有任何地方告诉用户"系统支持哪些语言"、各自的中英文名称是什么。新增不常见语言、规范化命名都缺乏一致来源

本次变更新增系统级 locales 字典表,并把命名空间的语言选择改为基于该字典的多选;字典默认随迁移注入 12 个常用语言,后续可由 superuser 在管理页扩充。

## What Changes

### A. 系统级 locales 字典(新 capability)

- 新增 `locales` 表:`code` (PK,如 `zh-cn`)、`label`(中文)、`englishLabel`(英文)、`nativeLabel`(母语,可选)、`region`(可选 ISO 区域)、`isBuiltin`(布尔)、`enabled`(布尔)、`sortOrder`、`createdAt`、`updatedAt`
- 通过新增的 drizzle migration **内联 INSERT 12 条内置 locale**(不通过应用代码 lazy seed):`zh-cn / zh-tw / en-us / en-gb / ja-jp / ko-kr / fr-fr / de-de / es-es / pt-br / ru-ru / ar-sa`,`isBuiltin=1, enabled=1, sortOrder` 按数组顺序
- 新增 `app/lib/services/locale.server.ts`:`listLocales` / `listEnabledLocales` / `getLocale` / `createLocale` / `updateLocale` / `deleteLocale` / `setEnabled`,事务 + Drizzle
- 删除/禁用规则:
  - `isBuiltin=1` 不可删除,但可 `enabled=0`(下沉到字典末端,multi-select 不再展示)
  - 任意 `namespaces.locales` 仍引用的 code 不可删除,也不可 `enabled=0`,服务层抛 409
  - 删除 / 禁用都需要 `superuser`

### B. 命名空间侧严格收紧(modify capability)

- `createNamespace` / `updateNamespace`:每个传入的 `locale` 必须存在于 `locales` 表中且 `enabled=1`,否则 422
- `defaultLocale` 必须既在传入的 `locales` 列表中,又在系统字典中 enabled
- 默认值:`createNamespace` 不传 `locales` 时,从系统字典里取**前 3 个 enabled 的内置 locale**(等价于现状 `zh-cn / zh-tw / en-us`,但来源改为字典)
- 移除现行 `app/lib/services/namespace.server.ts` 中硬编码的 `DEFAULT_LOCALES = ['zh-cn','zh-tw','en-us']`

### C. 一次性历史数据修复(strict P)

为兼容 modernization 之前已经存在的 namespace(其 `locales` JSON 可能含未在字典里的 code),发布本次变更时:

- 提供一次性脚本 `app/scripts/repair-locales.ts`(可通过 `pnpm -F i18n-studio repair:locales` 调用)
- 脚本流程:
  1. 扫描 `namespaces.locales` JSON 的所有 distinct code
  2. 对字典里不存在的 code:
     - 默认(无 `--auto-add`)报告并 **退出非零**,提示运维人工决定:删除该 namespace 中的引用、还是补 LOCALE 入字典
     - `--auto-add` 模式:把缺失 code 以 `isBuiltin=0, enabled=1, label=code, englishLabel=code` 入字典,保证服务层不再报错
- 选择不在迁移里自动修复,因为修复需要语义判断;脚本退出非零是显式 fail-fast,符合"严格"约束

### D. UI 多选组件(modify capability `i18n-namespace-membership`)

- 新增 `app/components/locale-multi-select.tsx`:
  - shadcn `Popover` + `Command` 实现
  - 触发器显示已选 locale Badge(可 `×` 移除),并在末尾显示 `▾`
  - 弹层内 `CommandInput` 支持模糊搜索 `code` / `label` / `englishLabel` / `nativeLabel`
  - 列表项:`code` 单等宽 + `label` + `nativeLabel`(若与 label 不同)
  - **不提供"自定义 locale"选项** — 没有的语言必须先去 `/dashboard/locales` 加
  - 表单提交时序列化为 hidden input(`name="locales"`,值 `code1,code2,...`)
- `default locale` 改为 shadcn `Select`,选项 = 当前已选 locales(联动)
- 替换以下输入:
  - `app/routes/ns.new.tsx` 的"语言列表"文本框
  - `app/routes/ns.$slug.settings.tsx` 的"Locales"与"Default locale"文本框

### E. /locales 管理页(新增,superuser only)

- 新增路由 `app/routes/locales.tsx`:
  - 任意已登录用户可读
  - 仅 `user.isSuperuser` 可写(创建 / 编辑 / 启停 / 删除)
  - 用 shadcn `Table` 渲染
  - 操作:新建 / 编辑 / 启停(toggle)/ 删除(双确认 Dialog)
- 入口:
  - 顶部用户菜单 `DropdownMenu` 末尾追加 "Manage locales"(仅 superuser 可见)
  - 命令面板 "Theme" 之前加一组 "System",含 "Manage locales" 行(仅 superuser 可见)
- 页面 `meta()` 标题:`Locales · i18n-studio`

## Capabilities

### New Capabilities

- `i18n-locale-management`:系统级语言字典(表 + service + 管理页 + 选择组件),为多个命名空间提供一致来源

### Modified Capabilities

- `i18n-entry-management`:`createNamespace` / `updateNamespace` 接受的 `locales` 必须为字典中 enabled 项,默认值由"硬编码 `zh-cn / zh-tw / en-us`"改为"字典前三个 enabled 内置 locale";UI 由文本输入改为基于字典的多选(参见 `specs/i18n-entry-management/spec.md`)

## Impact

- **schema**:新增 `locales` 表 + 一份 drizzle migration;不动现有 `namespaces.locales` 列(仍然以 JSON array 存 code 引用)
- **依赖**:无新外部依赖(沿用 modernization 引入的 shadcn `Popover` / `Command` / `Badge` / `Select`;`Select` 需要补 `@radix-ui/react-select`,已经存在)
- **数据**:既有数据不修改;若现有 db 中存在 `locales` JSON 含字典外 code,服务层会拒绝下次写入 → 提供 `repair:locales` 脚本人工处理
- **API 契约**:`POST/PATCH /api/namespaces/...`、内部 service 函数对 locale 的接受集合收窄;UI 在选择层就已防错,API 层兜底拒绝
- **回滚计划**:本次为新增表 + service 收紧;若需回滚:
  - 数据层:删除 `locales` 表,代码层恢复硬编码 `DEFAULT_LOCALES`
  - 但既有 namespace 的 `locales` 列内容不会丢失,回滚后行为退化为原"自由文本"
- **不影响**:词条/翻译/任务/同步/快照流程,bundle_version 行为不变;modernization 引入的 shell / cmd-k / dark mode 不变
