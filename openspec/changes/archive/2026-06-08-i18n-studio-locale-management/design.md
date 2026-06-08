# Design — i18n-studio Locale Management

## A. Schema

### A.1 表定义(drizzle 风格)

```ts
// app/db/schema.ts (新增)
export const locales = sqliteTable('locales', {
  code: text('code').primaryKey(),                      // 'zh-cn'
  label: text('label').notNull(),                       // '简体中文'
  englishLabel: text('english_label').notNull(),        // 'Simplified Chinese'
  nativeLabel: text('native_label'),                    // '中文(简体)'  可选
  region: text('region'),                                // 'CN' / 'US' / null
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
```

**为什么用 `code` 作 PK 而不是 ulid**:
- locales 是低频写入的字典表,行数 ~15-30
- 引用方(`namespaces.locales` 是 JSON 数组存 code 字符串)使用的就是 code
- code 天然唯一(BCP-47 + 我们小写规范),省一次 join

**为什么不在 `namespaces.locales` 改成外键 / join 表**:
- 多对多 join 表(`namespace_locales`)会改动现有大量代码(query / sync / snapshot 等);成本远高于本次需要解决的问题
- 现状 JSON 列 + 应用层强校验已能保证一致性
- 删除/禁用 locale 时主动校验"是否被任意 namespace 引用"

### A.2 Migration 内联 seed

drizzle-kit 生成的迁移基础上手动追加 INSERT(drizzle-kit 仅产 DDL,seed 需手补):

```sql
-- 0001_xxxx_add_locales.sql (示意)
CREATE TABLE locales (
  code TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  english_label TEXT NOT NULL,
  native_label TEXT,
  region TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO locales (code, label, english_label, native_label, region, is_builtin, enabled, sort_order, created_at, updated_at) VALUES
  ('zh-cn', '简体中文',   'Simplified Chinese',  '中文(简体)', 'CN', 1, 1,  0, 0, 0),
  ('zh-tw', '繁體中文',   'Traditional Chinese', '中文(繁體)', 'TW', 1, 1, 10, 0, 0),
  ('en-us', '英语 (美国)', 'English (US)',        'English',    'US', 1, 1, 20, 0, 0),
  ('en-gb', '英语 (英国)', 'English (UK)',        'English',    'GB', 1, 1, 30, 0, 0),
  ('ja-jp', '日语',       'Japanese',             '日本語',     'JP', 1, 1, 40, 0, 0),
  ('ko-kr', '韩语',       'Korean',               '한국어',     'KR', 1, 1, 50, 0, 0),
  ('fr-fr', '法语',       'French',               'Français',   'FR', 1, 1, 60, 0, 0),
  ('de-de', '德语',       'German',               'Deutsch',    'DE', 1, 1, 70, 0, 0),
  ('es-es', '西班牙语',   'Spanish',              'Español',    'ES', 1, 1, 80, 0, 0),
  ('pt-br', '葡萄牙语 (巴西)', 'Portuguese (BR)', 'Português',  'BR', 1, 1, 90, 0, 0),
  ('ru-ru', '俄语',       'Russian',              'Русский',    'RU', 1, 1, 100, 0, 0),
  ('ar-sa', '阿拉伯语',   'Arabic',               'العربية',    'SA', 1, 1, 110, 0, 0);
```

`created_at` / `updated_at` 用 0 表示"未跟踪"是符合"内置随迁移注入"的语义,普通用户在管理页通过 service 创建的项才有真实时间戳。

**为什么不在应用代码 lazy seed**:
- 多副本 / 多进程并发时会出现重复 seed 竞态(虽然有 PK 唯一约束兜底)
- 迁移文件是"声明式真相"的天然位置,与表 schema 同生命周期
- 测试侧:`buildTemplateDb()` 跑一次 migrate,template 里就已经有 12 条 — 集成测试无需额外 setup

## B. 服务层

### B.1 locale.server.ts 形态

```ts
export interface LocaleRow { ... }
export interface CreateLocaleInput {
  code: string; label: string; englishLabel: string;
  nativeLabel?: string; region?: string;
}

export function listLocales(opts?: { enabledOnly?: boolean }): LocaleRow[];
export function listEnabledLocales(): LocaleRow[];   // 给 UI 用
export function getLocale(code: string): LocaleRow | null;
export function createLocale(input: CreateLocaleInput): LocaleRow;
export function updateLocale(code: string, patch: Partial<CreateLocaleInput>): LocaleRow;
export function setEnabled(code: string, enabled: boolean): LocaleRow;  // 启停
export function deleteLocale(code: string): void;     // 仅 isBuiltin=0 且无引用

// 内部辅助:
export function assertLocalesExist(codes: string[]): void;  // 422 throw
export function listReferencingNamespaces(code: string): { id: string; slug: string }[];
```

校验规则:
- `code` 形如 `xx` 或 `xx-xx`,小写,与 `localeSchema` 一致
- `code` 唯一(PK 自然保证)
- `label` / `englishLabel` 必填,长度 1-64
- `region` 长度 ≤ 8(允许 ISO 3166 alpha-2/3 或扩展子标签)
- 删除 / 禁用 / 改 code 前调用 `listReferencingNamespaces(code)`,非空 → 抛带详细信息的 422

### B.2 namespace.server.ts 收紧点

```diff
- export const DEFAULT_LOCALES = ['zh-cn', 'zh-tw', 'en-us'];

  export function createNamespace(input: CreateNamespaceInput): Namespace {
    ...
-   const locales = input.locales && input.locales.length > 0 ? input.locales : DEFAULT_LOCALES;
-   for (const l of locales) {
-     localeSchema.parse(l);
-   }
+   const locales = input.locales && input.locales.length > 0
+     ? input.locales
+     : listEnabledLocales().slice(0, 3).map(l => l.code);
+   if (locales.length === 0) {
+     throw new Error('系统语言字典为空,请先在 /dashboard/locales 中添加 locale');
+   }
+   assertLocalesExist(locales);   // 422 if any code 未注册或 enabled=0
    ...
  }
```

`updateNamespace` 中对 `patch.locales` 做同样校验。

### B.3 服务层校验失败的错误形态

沿用 `app/lib/api.server.ts` 的 `jsonError(422, code, message)` 风格。新错误码:
- `locale_not_found` — 引用未在字典中的 code
- `locale_disabled` — 引用 enabled=0 的 code
- `locale_in_use` — 删除/禁用被 namespace 引用的 code
- `locale_builtin_undeletable` — 删除 isBuiltin=1
- `locale_dictionary_empty` — namespace 创建时无任何 enabled locale 可用

## C. 历史数据修复脚本

### C.1 脚本位置与调用方式

```
app/scripts/repair-locales.ts        ← 入口,使用 tsx 运行
package.json scripts:
  "repair:locales": "tsx app/scripts/repair-locales.ts"
```

通过 `pnpm -F i18n-studio repair:locales [--auto-add]` 触发。

### C.2 流程

```
1. 打开 db (DATABASE_FILE)
2. 读取 locales 表已有 code 集合 D
3. 读取 namespaces 表的 locales JSON,聚合所有 distinct code 集合 N
4. missing = N - D
5. 若 missing 非空:
   a. 默认输出报告:
      "Found N namespaces referring to M codes not in dictionary:"
      "  code=xx-yy referenced by [slug-a, slug-b]"
      然后 exit code 1
   b. --auto-add:
      - 把 missing 中每个 code 以 isBuiltin=0, enabled=1, label=upper(code), englishLabel=code, sortOrder=999+i 插入
      - 输出 "Auto-added M codes to dictionary"
      - exit 0
6. 若 missing 为空:输出 "No repair needed.",exit 0
```

`--auto-add` 模式产生的 label 仅为占位,管理员后续可在 `/dashboard/locales` 编辑。

## D. UI 多选组件

### D.1 props 形态

```tsx
interface LocaleMultiSelectProps {
  /** 当前已选 code 列表(受控) */
  value: string[];
  onChange: (next: string[]) => void;
  /** 系统已 enabled 的字典项,从 loader 注入 */
  options: Array<{ code: string; label: string; englishLabel: string; nativeLabel: string | null }>;
  /** 表单 hidden input 名 */
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  /** 至少选 N 个 */
  minSelected?: number;
  className?: string;
}
```

### D.2 视觉草图

```
┌──────────────────────────────────────────────────────┐
│ [zh-cn ×] [zh-tw ×] [en-us ×]                  [▾]  │  ← 触发按钮
└──────────────────────────────────────────────────────┘
       ↓ 点开
┌──────────────────────────────────────────────────────┐
│ 🔍 搜索 (code / label / native)                      │
├──────────────────────────────────────────────────────┤
│ ☑ zh-cn  简体中文          中文(简体)                │
│ ☑ zh-tw  繁體中文          中文(繁體)                │
│ ☑ en-us  English (US)                               │
│ ☐ ja-jp  日本語                                      │
│ ☐ ko-kr  한국어                                       │
│ ─────────────────────────────────                   │
│ ⓘ 没有想要的语言?去 [系统设置 → 语言库] 添加          │  ← superuser
│   或:没有想要的语言?请联系管理员添加                 │  ← 普通用户
└──────────────────────────────────────────────────────┘
```

不提供"自定义"按钮(用户决策 strict)。

### D.3 表单序列化

组件内部维护 `value: string[]`,渲染时:

```tsx
<input type="hidden" name={name} value={value.join(',')} />
```

服务端 `action()` 通过 `String(form.get('locales')).split(',').filter(Boolean)` 还原。

### D.4 Default locale 选择联动

`ns.new.tsx` / `ns.$slug.settings.tsx` 同时维护 `selectedLocales` 与 `defaultLocale`:

```
selectedLocales 变更:
  if defaultLocale 不在 selectedLocales:
    defaultLocale = selectedLocales[0] ?? ''
```

`<Select>` 的 options = `selectedLocales`,这样不会出现"default 不在已选"的非法态。

## E. /dashboard/locales 管理页

### E.1 权限

- `loader`:`requireUser(request)` — 任意登录用户可读(因为命名空间内的 ns/new 也需要看选项;可考虑直接调 service 由前端传 options,但管理页本身仍是只读对所有人开放)
- `action`:在 `requireUser` 之后,若 `!user.isSuperuser` 抛 403
- 仅入口在 superuser 的 UI 中可见,但 URL 直接访问也允许只读

### E.2 路由

```
/dashboard/locales            → list + create/edit (modal Sheet)
                       superuser 可看到 [Add] / [Edit] / [Disable] / [Delete] 按钮
                       普通用户只看到只读列表
```

不引入 `/dashboard/locales/$code` 子路由 — 所有 CRUD 通过 Sheet 在主页面内完成,简化路由。

### E.3 入口

```
header DropdownMenu (AppShellHeader):
  ├ Namespaces
  ├ ─────
  ├ Manage locales        ← isSuperuser 才显示
  ├ ─────
  └ Logout

CommandPalette → System group (isSuperuser):
  └ Manage locales         ← navigate('/dashboard/locales')
```

`AppShellHeader` 接收 `user.isSuperuser`,`CommandPalette` 通过 root loader 注入 `isSuperuser` 字段。

### E.4 删除流程

shadcn Dialog 双确认:
1. 点 "Delete" → 打开 Dialog,标题 "Delete locale {code}?"
2. 描述区显示:"将永久从字典中移除该语言。仅未被任何 namespace 引用且非内置的语言可删除。"
3. 若服务层抛 `locale_in_use`,toast.error 列出引用的 namespace slug 前 5 个

## F. 测试

### F.1 unit (template db 已含 12 条)

```
tests/integration/locale.test.ts:
  describe('locale dictionary', () => {
    describe('built-in seed', () => {
      'template db 含 12 条内置 enabled locale'
      'sortOrder 严格递增'
    })
    describe('CRUD', () => {
      'createLocale 成功'
      'createLocale code 重复 → 抛'
      'createLocale label 缺失 → 抛'
      'updateLocale label/englishLabel'
      'setEnabled true → false → true'
      'deleteLocale 非内置成功'
    })
    describe('protections', () => {
      'deleteLocale 内置 → 抛 locale_builtin_undeletable'
      'deleteLocale 被引用 → 抛 locale_in_use,errors 含引用的 namespace'
      'setEnabled(false) 被引用 → 抛 locale_in_use'
    })
  })
```

### F.2 namespace 收紧

`tests/integration/namespace.test.ts` 扩 describe `'locale dictionary integration'`:
- `createNamespace` locales 含字典外 code → 抛 `locale_not_found`
- `createNamespace` locales 含 enabled=0 → 抛 `locale_disabled`
- `updateNamespace` 同上
- `createNamespace` 不传 locales → 取字典前 3 个 enabled

### F.3 历史数据修复脚本

`tests/integration/locale-repair.test.ts`:
- 制造一个"脏" template:在 namespaces.locales 写入字典外 code(直接 SQL 插入,绕过 service)
- 跑修复脚本(直接调用模块导出的 `repairLocales({ autoAdd: false })` 函数,而非 spawn 子进程):返回 missing 列表 + 不修改 db
- 跑 `repairLocales({ autoAdd: true })`:missing 已入字典,enabled=1, isBuiltin=0
- 再跑:返回 0 missing

### F.4 测试期望:`templateDbPath` 共享带 seed 的库

`tests/test-db.ts` 的 `buildTemplateDb()` 不需要变化 — 因为 migration 文件已含 INSERT,跑过 migrate 后 template.db 自动包含 12 条。

## G. 不在本次范围

- 不为非 superuser 提供"申请新增 locale"的工单流程
- 不在本次实现 locale 别名 / 同义词(如 `zh-Hans` → `zh-cn` 自动归一)
- 不实现批量启停 / 批量删除
- 不为 locale 增加图标 / 国旗 emoji(国旗 emoji 与 locale 不是 1:1 关系,容易引发政治性误读;label 已能区分)
- 不引入第三方 CLDR 数据包(`@formatjs/intl-locale` 等),12 个内置足够;后续若要补充由 superuser 在 UI 添加

## H. 风险

| 风险 | 缓解 |
| ---- | ---- |
| 现有数据库中存在字典外 code | `repair:locales` 脚本 + 文档明确升级步骤 |
| superuser 误删 / 误禁用导致 namespace 写入失败 | service 层在删除前主动校验引用集合 |
| migration INSERT 与 ORM 列定义不一致(boolean ↔ integer) | drizzle 已用 `mode: 'boolean'` 自动处理;迁移 SQL 写 0/1 |
| 用户期望 locale 选择能回退到自由文本 | 显式拒绝 — 这是本次变更的主张;若日后需要再引入"自定义 BCP-47"选项,扩展 isBuiltin=0 + 一个 self-service workflow |
| `/dashboard/locales` 路由对所有登录用户可读,可能暴露管理员私设的 label | label 不属敏感信息;读权限保持开放,避免 ns 创建流程因权限拆得过细而绕路 |
