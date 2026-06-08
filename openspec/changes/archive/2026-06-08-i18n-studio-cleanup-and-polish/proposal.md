## Why

复检 i18n-studio 三个 change(modernization / locale-management / public-shell)后,发现一组**遗留的死链、缺漏与未现代化页面**。这些项各自规模都不大,但叠加在一起会让"已上线 + 已完成"的现状名不副实——命令面板核心交互失效、半数后台子页面与 entries 列表视觉密度不一致、spec 文档里仍引用废弃路径。在 modernization 进入 archive 之前一次性收口,比之后再各自起 change 更省事。

## What Changes

### A. 死链 / Bug 修复(P0)

- 修 `app/root.tsx` 的 `currentSlug` 正则:`^/ns/...` → `^/dashboard/...`,恢复 ⌘K 在 `/dashboard/<slug>/...` 下的 Navigate 与 entries 词条搜索
- `app/routes/dashboard.$slug.entries.$key._index.tsx` 的 `PublishDraftRow`:`window.location.reload()` → `useRevalidator().revalidate()`,与 `history.tsx` 写法对齐
- 回填 `i18n-studio-locale-management` 所有 spec 内 `/locales` 字面量 → `/dashboard/locales`(含 i18n-locale-management/spec.md scenario 句)
- 同步检查 `public-shell` spec 内是否仍有 `/ns/*` 残留,如有一并清理

### B. 后台五页 UI 现代化(P1)

把 modernization 6.x 漏掉的页面统一切到与 entries 列表一致的 shadcn 视觉密度:

- `dashboard.$slug.sync.tsx`:用 `Select` 选源命名空间与策略;用 `LocaleMultiSelect` 选 locale;用 `Switch` 表达 `autoPublish` / `dryRun`;结果用 `Card` + `<pre>` 包裹
- `dashboard.$slug.tasks.tsx`:列表用 shadcn `Table`;target locales 用 `LocaleMultiSelect`;状态用 `Badge`
- `dashboard.$slug.members.tsx`:列表用 shadcn `Table`;角色用 `Select`
- `dashboard.$slug.settings.tsx`:tokens 列表用 `Table`;scope 用 `Select`;`publicRead` 用 `Switch`;新建 token 后明文加 lucide `Copy` 按钮 + `navigator.clipboard.writeText`
- `dashboard.$slug.entries.$key.history.tsx`:7 列裸 `<table>` 改 shadcn `Table`

### C. 架构 / UX 微项(P2)

- **共享 dashboard shell**:让 `dashboard.tsx` 在 loader 集中获取 `user` / `theme`,通过 outlet context 下发并自挂 `AppShellHeader`;子路由 `dashboard._index` / `dashboard.new` / `dashboard.locales` / `dashboard.$slug` 不再各自挂 header、不再各自 `getTheme()`/`getUser()`(`dashboard.$slug` 仍在 layout 内追加 namespace 子侧栏)
- entries 列表的批量删除 / discard:循环 `await` → `Promise.allSettled`
- `getNamespaceLocales(ns)` 在 entries 列表 / 编辑页 render 期重复 `JSON.parse`:loader 内 parse 一次,组件直接用数组
- builtin locale 的"禁用"按钮加 `Dialog` 二次确认,误关 `zh-cn` 不会一键得逞
- `app/lib/docs.ts` `extractFrontmatter` 自写正则 → 引入 `gray-matter`(零运行时影响,build 期 only)

### D. tasks.md 状态收口

- 在 `i18n-studio-modernization/tasks.md` 追加一节"延后到 cleanup-and-polish"指向本 change,不再保留误标的 ✅
- `i18n-studio-public-shell/tasks.md` 同步标注 landing-header / landing-footer 复用 `AppShell*` 的事实(防止 archive 时 strict validator 抓偏差)

## Capabilities

### New Capabilities

无。本次为整治型 change,不引入新 capability。

### Modified Capabilities

- `i18n-studio-ui-shell`:命令面板"当前 namespace"上下文要从 `/dashboard/<slug>` 解析(原先约束写的是 `/ns/<slug>`);后台 dashboard 区域 layout 集中托管 `AppShellHeader`(原先要求"每个 dashboard 路由各自挂 header"应去掉)

(`i18n-studio-locale-management` 与 `i18n-studio-public-shell` 内 `/locales`、`/ns/*` 字面量替换属于文档/scenario 表述更正,不是行为变更,不计入 modified capability。)

## Impact

- **代码**:
  - `app/root.tsx`(2 行)
  - `app/routes/dashboard.tsx`(loader + AppShellHeader 集中)
  - `app/routes/dashboard._index.tsx` / `dashboard.new.tsx` / `dashboard.locales.tsx`(去掉重复 header,改读 outlet context)
  - `app/routes/dashboard.$slug.entries.$key._index.tsx`(reload → revalidator)
  - `app/routes/dashboard.$slug.entries._index.tsx`(并发 + locales prop 化)
  - `app/routes/dashboard.$slug.{sync,tasks,members,settings,entries.$key.history}.tsx`(整页 UI 重写)
  - `app/lib/docs.ts`(frontmatter 解析换 gray-matter)
- **依赖**:`gray-matter` 加入 `dependencies`(单一新增,build/runtime 都会用到 doc loader)
- **spec 文档**:`i18n-locale-management/spec.md`、`i18n-studio-public-shell/spec.md` 内路径回填
- **tasks 状态**:`i18n-studio-modernization/tasks.md` / `i18n-studio-public-shell/tasks.md` 追加备注节,不改既有打勾状态(尊重历史)
- **不影响**:服务层(`lib/services/*.server.ts`)对外行为契约、数据库 schema、API 路径、错误码、snapshot 通道、token 鉴权
- **测试**:新增 `tests/unit/dashboard-layout.test.ts` 验证子路由读到 outlet context;扩展 `tests/unit/landing-loader.test.ts` 不变;集成测试不变

## 回滚计划

本次内部结构性变更,按子模块独立回滚:

- A 段(死链修复):每条都是 1-3 行,可单独 revert
- B 段(UI 现代化):每个页面独立 commit,可逐个 revert
- C 段:`dashboard.tsx` shell 集中是最有牵涉的一步,如需回滚仅需把 `AppShellHeader` 复制回各子路由 + 恢复各自的 `getTheme()`/`getUser()` loader 段
- D 段:文档变更不影响运行时,可直接 revert

最坏情况下回滚到本 change 之前的 main,功能与 modernization 收尾时一致。
