## 1. Schema 与 Migration

- [x] 1.1 在 `app/db/schema.ts` 新增 `locales` 表(列见 design A.1),并 `export type Locale`
- [x] 1.2 跑 `pnpm -F i18n-studio db:generate`,产出新迁移 SQL 文件(`0001_worthless_carlie_cooper.sql`)
- [x] 1.3 手工在生成的 SQL 文件末尾追加 12 条 `INSERT INTO locales` 内置 seed(见 design A.2 与 spec 表)
- [x] 1.4 删除可能产生的旧 `tests/.tmp/_template.db` 缓存,确认下次测试启动会重新构建

## 2. locale 服务层

- [x] 2.1 新建 `app/lib/services/locale.server.ts`:
  - [x] 2.1.1 实现 `listLocales` / `listEnabledLocales` / `getLocale` / `createLocale` / `updateLocale` / `setEnabled` / `deleteLocale`
  - [x] 2.1.2 实现 `assertLocalesExist(codes)`(失败时通过 `app/lib/api.server.ts` 的 `jsonError(422, code, msg)` 抛 Response)
  - [x] 2.1.3 实现 `listReferencingNamespaces(code)`,扫描 `namespaces.locales` JSON
  - [x] 2.1.4 服务层错误码:`locale_not_found` / `locale_disabled` / `locale_in_use` / `locale_builtin_undeletable` / `locale_dictionary_empty`
- [x] 2.2 在 `app/lib/validators.ts` 暴露 `parseLocaleCode` 辅助(沿用 `localeSchema`),或直接在 `locale.server.ts` 内调用

## 3. namespace 服务层收紧

- [x] 3.1 删除 `app/lib/services/namespace.server.ts` 中的 `DEFAULT_LOCALES` 常量
- [x] 3.2 `createNamespace`:
  - [x] 3.2.1 入参未提供 `locales` 时,调 `listEnabledLocales().slice(0,3)` 取默认值;若结果为空抛 `locale_dictionary_empty`
  - [x] 3.2.2 否则调用 `assertLocalesExist(locales)`(替代原先 `localeSchema.parse`)
  - [x] 3.2.3 `defaultLocale` 缺省时取 `locales[0]`,显式提供时仍校验"必须 ∈ locales"
- [x] 3.3 `updateNamespace`:对 `patch.locales` / `patch.defaultLocale` 做同样校验
- [x] 3.4 删除 `app/lib/services/namespace.server.ts` 中导出的 `DEFAULT_LOCALES`,并修复 `app/routes/ns.new.tsx` 等所有 import

## 4. /locales 路由与 UI

- [x] 4.1 新建 `app/routes/locales.tsx`:
  - [x] 4.1.1 `loader` 调 `listLocales()` 返回全部行(含 disabled)
  - [x] 4.1.2 `action`:`requireUser` + `if (!user.isSuperuser) throw jsonError(403, ...)`,根据 `intent` 分派 create / update / setEnabled / delete
  - [x] 4.1.3 `meta`:`Locales · i18n-studio`
- [x] 4.2 渲染:
  - [x] 4.2.1 用 shadcn `Table`,列:code / label / english / native / region / 内置 / 状态 / 操作
  - [x] 4.2.2 superuser 顶部"+ Add locale"按钮,打开 `Sheet` 内的表单
  - [x] 4.2.3 行内"Edit"按钮,同样打开 Sheet
  - [x] 4.2.4 启停用 Toggle 按钮(立即提交)
  - [x] 4.2.5 删除用 `Dialog` 双确认,失败时通过 `sonner.toast.error` 列出引用 namespace
- [x] 4.3 入口接入:
  - [x] 4.3.1 `app/components/app-shell.tsx`:user DropdownMenu 末尾加 "Manage locales"(仅 `user.isSuperuser` 渲染)
  - [x] 4.3.2 `app/components/command-palette.tsx`:加 "System" 分组,含 "Manage locales"(仅 superuser);root loader 注入 `isSuperuser`

## 5. locale 多选组件

- [x] 5.1 新建 `app/components/locale-multi-select.tsx`:`Popover` + `Command` + `Badge`,接 props 见 design D.1
- [x] 5.2 行为:
  - [x] 5.2.1 选项来源仅 `enabled=1` 的字典项
  - [x] 5.2.2 搜索匹配 code / label / englishLabel / nativeLabel
  - [x] 5.2.3 已选用 Badge + `×` 显示在触发器内
  - [x] 5.2.4 弹层底部根据 `isSuperuser` 显示"去 /locales 添加"或"联系管理员"提示,但**不**提供自定义 locale 入口
  - [x] 5.2.5 内部维护 `value: string[]`,渲染 `<input type="hidden" name={name} value={value.join(',')} />`
- [x] 5.3 接入 `app/routes/ns.new.tsx`:替换 "语言列表" 文本框,`defaultLocale` 改为 shadcn `Select`,选项联动
- [x] 5.4 接入 `app/routes/ns.$slug.settings.tsx`:同上;额外校验"被引用的 locale 不能被去勾选"在服务端已有,UI 仅给出 hint

## 6. 历史数据修复脚本

- [x] 6.1 新建 `app/scripts/repair-locales.ts`:导出 `repairLocales({ autoAdd: boolean })` 与一个 CLI 入口
- [x] 6.2 流程见 design C.2;输出格式人类可读
- [x] 6.3 在 `package.json` 增加 `"repair:locales": "tsx app/scripts/repair-locales.ts"`,并在 `devDependencies` 增补 `tsx`
- [x] 6.4 在 README.md 增加一节"升级注意:从 modernization 升级到 locale-management 时如何处理历史 locale"

## 7. 测试

- [x] 7.1 `tests/integration/locale.test.ts`:
  - [x] 7.1.1 builtin seed:template db 含 12 条 enabled 内置,sortOrder 递增
  - [x] 7.1.2 CRUD 全套
  - [x] 7.1.3 删除/禁用保护:builtin / in_use 各场景
  - [x] 7.1.4 `assertLocalesExist`:not_found / disabled / 通过
- [x] 7.2 `tests/integration/namespace.test.ts` 扩 `'locale dictionary integration'` describe:
  - [x] 7.2.1 createNamespace locales 含字典外 → 抛 not_found
  - [x] 7.2.2 createNamespace locales 含 disabled → 抛 disabled
  - [x] 7.2.3 updateNamespace 同上
  - [x] 7.2.4 createNamespace 不传 locales → 取字典前 3 个 enabled
- [x] 7.3 `tests/integration/locale-repair.test.ts`:
  - [x] 7.3.1 制造脏数据:直接 `db.run(sql\`UPDATE namespaces SET locales = '["xx-yy"]'...\`)` 注入字典外 code
  - [x] 7.3.2 `repairLocales({ autoAdd: false })` 返回 missing 不空,db 不变
  - [x] 7.3.3 `repairLocales({ autoAdd: true })` 入字典,enabled=1, isBuiltin=0
  - [x] 7.3.4 再跑一次,无 missing
- [x] 7.4 跑完整 `pnpm -F i18n-studio test`,期望 96 + 新增 ~25 全绿(实际 121 全绿)

## 8. 收尾

- [x] 8.1 `pnpm -F i18n-studio typecheck` 通过
- [x] 8.2 `pnpm -F i18n-studio test` 全绿(121/121)
- [x] 8.3 `pnpm -F i18n-studio build` 通过
- [x] 8.4 `pnpm exec oxlint lint packages/apps/i18n-studio/app` 仅有改造前已存在的 warning(`_e` 未用)
- [x] 8.5 `pnpm format:write`
- [x] 8.6 README 已包含:locale 管理页 / 多选交互 / 修复脚本调用方式
- [x] 8.7 `openspec validate i18n-studio-locale-management --strict` 通过
