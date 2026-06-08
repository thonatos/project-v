## Context

i18n-studio 经过三轮 change(modernization → locale-management → public-shell)后已经"能用"。但在 archive 之前对代码做了一轮系统复检,发现几类共性问题:

1. **历史路径残留**:public-shell 把 `/ns/*` → `/dashboard/*`,但 `app/root.tsx` 内的命令面板 `currentSlug` 解析与 locale-management spec 内 scenario 文本都没回填
2. **现代化覆盖不全**:modernization 6.x 任务清单只覆盖了 entries 列表 + landing/login/register/new + dashboard overview;`sync` / `tasks` / `members` / `settings` / `entries.$key.history` 五个高频后台页仍是裸 `<table>` + `<select>`,与已经升级的页面视觉密度不一致
3. **架构小别扭**:`dashboard.tsx` 是空 Outlet,每个 dashboard 子路由各自挂 `AppShellHeader` 并各自重复 `getTheme()` / `getUser()`,违背 layout-route 的本意
4. **若干小 UX 缺陷**:批量删除串行 `await`、`JSON.parse(ns.locales)` 在 render 期重复、builtin locale 一键禁用无确认、新建 token 后明文无复制按钮等

每一项单独看都不大,但凑在一起就让"已完成"的状态有点虚。本 change 一次性收口,让 modernization / locale-management / public-shell 三个 change 都能干干净净进 archive。

### 当前状态摘要

```
openspec/changes/
├── i18n-studio-modernization      [in-progress 45/51]  (留尾:docker smoke + 浏览器手测)
├── i18n-studio-locale-management  [complete 32/32]     (spec 含 /locales 死链)
└── i18n-studio-public-shell       [complete 91/91]     (root.tsx /ns 死链 + landing-header 任务标错)
```

## Goals / Non-Goals

**Goals:**

- 修掉所有由 public-shell 路径迁移引发的死链(命令面板、spec 文档、可能存在的其它字面量)
- 让后台 5 个页面的视觉密度与 entries 列表对齐(同一套 shadcn `Table` / `Select` / `Switch` / `Badge` / `Card` 组合)
- 让 dashboard 区域有一个**真正起作用的 layout route**:子路由不再各自挂 header 和取 user/theme
- 顺手补 5 个独立的 UX 微缺陷,每个改动 < 30 行,集中起来一次 review 比分散到将来五个 change 划算
- 在不动行为契约 / 数据 schema / 测试存量的前提下,让 modernization tasks.md 内"未完成"项有明确的去向(指向本 change 或标注"延后到 cleanup")

**Non-Goals:**

- **不**改服务层(`lib/services/*.server.ts`)对外行为契约,无新错误码、无 schema 变更、无 API path 调整
- **不**重写 entries 列表 / dashboard overview / login / register / new(已现代化)
- **不**新增功能性 capability(translation / sync / task / snapshot 行为完全不动)
- **不**触碰已经 archive 的 `i18n-entry-management` / `i18n-namespace-membership` spec
- **不**做 Playwright / 浏览器自动化测试,manual smoke 项继续承认是手测

## Decisions

### D1. 命令面板路径解析:在 root loader 用正则 vs 注入 outlet context

**选择**:**正则修复** —— 把 `^/ns/...` 改成 `^/dashboard/([^/]+)`。

**理由**:

- 改动量最小(2 行 regex 替换)
- 与现状架构一致:命令面板挂在 `<Layout>` 全局,需要从 URL 解析当前 slug,因为 `<Layout>` 拿不到子 outlet context
- 替代方案"让 dashboard 路由通过 fetcher 把 `currentSlug` 写入 cookie 给 root loader 读"过度工程

**其它考虑**:

- 用 `useMatches()` 在客户端解析:`<CommandPalette />` 已经在 root layout 里,可以直接用 `useMatches()` 取 `params.slug`。这是更"React Router native"的方案,改动也不大
- 但这要把命令面板从 SSR 计算 currentSlug 改成纯客户端,需要 verify 在 SSR 时 `<CommandPalette open={false}>` 不会出现 hydration 错误。比 regex 修复多一点不确定性。
- **决策**:先做 regex 修复(立即解决死链),如果将来想去掉 root loader 里的 URL 解析再迁到 `useMatches()`

### D2. dashboard layout 集中化:loader 注入 vs 组件复用

**选择**:**loader 注入 + outlet context**(让 `dashboard.tsx` loader 返回 `{ user, theme }`,通过 `<Outlet context={...} />` 下发,子路由用 `useOutletContext()`)

**理由**:

- 跟 `dashboard.$slug.tsx` 已有的 `NsContext` 是同一套模式,一致性
- 子路由不再各自调 `requireUser` / `getTheme`(layout 已经 `requireUser`,子路由只需要业务数据)
- 唯一需要保留 layout-level header 的是 `dashboard.locales.tsx` 与 `dashboard.new.tsx`(它们没有 namespace 子侧栏,直接渲染 main)。让 `dashboard.tsx` 默认渲染 `<AppShellHeader>`,`dashboard.$slug.tsx` 自己再渲染一层带 leadingSlot 的 header? 那会双层重叠。

**最终形态**:

```
┌────────────────────────────────────────────────────────────────┐
│ dashboard.tsx (layout)                                         │
│   loader: requireUser + getTheme                               │
│   outlet ctx: { user, theme }                                  │
│   (NOT 自挂 header,因为 dashboard.$slug.tsx 内的 header        │
│    需要 leadingSlot=Sheet 触发器,逻辑不一样)                   │
│                                                                │
│   ├── dashboard._index.tsx       自挂 AppShellHeader(无 slot)  │
│   ├── dashboard.new.tsx          自挂 AppShellHeader(有 crumbs)│
│   ├── dashboard.locales.tsx      自挂 AppShellHeader(有 crumbs)│
│   └── dashboard.$slug.tsx        自挂 AppShellHeader           │
│         (crumbs + leadingSlot=mobile sidebar Sheet)            │
└────────────────────────────────────────────────────────────────┘
```

**Trade-off**:Header 仍由子路由挂,因为不同子路由 header 形态不同(crumbs / leadingSlot)。但 user / theme 从 layout 一处获取,解决"重复 loader 调用"问题。这是平衡"DRY"与"显式 header 配置"的折中。

**替代方案**:

- 让 layout 渲染 header,子路由通过 outlet ctx 把 crumbs / leadingSlot 写回 layout —— React Router 没原生 ctx-up 通道,要靠 zustand / event bus,过度
- 让 layout 渲染 header,子路由用 portal 把 leadingSlot 投出去 —— 复杂度比当前重复挂 header 高

### D3. 五个后台页 UI 重写:平铺重写 vs 抽出 `<DataTable />` 通用组件

**选择**:**平铺重写**,每个页面用 shadcn `Table` 自己写表头与行。

**理由**:

- 各页 schema 差距很大:tasks 表 6 列 + 进度条、members 表角色 inline 改、settings token 表 5 列 + 撤销按钮、history 7 列 + 状态徽章 + 行操作
- 抽 `<DataTable />` 需要 column-def 框架(类似 TanStack Table),新增运行时依赖,跟 Non-Goals 冲突
- 平铺重写后五张表的代码各自 < 80 行,可读性比抽象高

**约束**:

- 表格视觉与 entries 列表 entries._index.tsx 保持一致:`<TableHead className="text-xs uppercase ...">`、`<TableRow className="border-t">`、actions 列右对齐
- 状态徽章统一用 `<Badge variant="...">`,颜色映射:`pending`/`draft` → secondary、`in_progress` → default、`completed`/`published` → success、`failed`/`cancelled` → destructive、`discarded`/`revoked` → outline

### D4. token 复制按钮:Web Clipboard API vs textarea 兜底

**选择**:**`navigator.clipboard.writeText` 直接调用**,失败时 `toast.error('复制失败,请手动选择')`。

**理由**:

- HTTPS / `localhost` 下 100% 可用,生产环境是 HTTPS
- 失败 fallback 是用户手动选,不需要兜底 textarea(老式 IE/Safari 兼容代码已无意义)

### D5. frontmatter 解析:`gray-matter` vs 修正自写正则

**选择**:**引入 `gray-matter`**(`dependencies`,~16KB)。

**理由**:

- 自写正则按 `:` split 已经被发现有 bug(中文冒号 / value 含 `: ` 被截断)
- `gray-matter` 是 markdown 工具链事实标准,与 unified pipeline 的生态匹配
- build 期一次性解析,运行时仅在 docs loader 调用,不影响 hot path
- 体积可接受(整个 docs.ts 已经依赖 unified + remark + rehype 系列,多 16KB 不显著)

**替代方案**:

- 把正则改成 `js-yaml` 解析:更准但增加依赖名,gray-matter 已经包含 `js-yaml`,选 gray-matter 一举两得
- 自己再写一套 YAML 解析器:不必

### D6. builtin locale 禁用二次确认:Dialog vs 直接禁用按钮文案警示

**选择**:**Dialog 二次确认**,文案明确"禁用 X 后,新建 namespace 默认会无 X 可选,确认?"。

**理由**:

- 与"删除"按钮已经的 Dialog 风格一致
- builtin locale 被禁用是低频操作,每次卡一步用户成本可忽略
- 没确认就一键禁用 `zh-cn`,会让所有新建 namespace 走 `listEnabledLocales().slice(0, 3)` 时丢首选,然后 fallback 到 `en-us` —— 真出现这种事,排查成本远高于二次确认

### D7. entries 批量并发:`Promise.allSettled` vs 后端 batch endpoint

**选择**:**`Promise.allSettled`**(纯客户端改动,不动 API)。

**理由**:

- 已有的 `publish-batch` API 只覆盖 publish,delete/discard 没 batch endpoint
- 加 batch endpoint 触及服务层 + spec 变更,与 Non-Goals "不改服务层"冲突
- 单页选 50 条,5 个并发 / 10 个并发都比串行 await 快得多,够用
- 失败仍逐条 toast,UX 不退化

### D8. modernization 任务收尾:重打勾 vs 追加备注

**选择**:**追加备注节,不改既有打勾**。

**理由**:

- 已经 commit 的 ✅ 打勾代表"当时认为完成",archive 后是历史记录
- 真实状态偏差(landing-header.tsx 实际复用 AppShellHeader 而非新建)在 design.md 解释清楚,比改打勾更诚实
- 在两份 tasks.md 末尾加一节 "## 后续整治(转移到 i18n-studio-cleanup-and-polish)" 列出 follow-ups,archive 时 strict validator 不会因此失败

## Risks / Trade-offs

### R1. dashboard layout loader 改动影响命中率

[Risk] 现在每次访问 `/dashboard/<slug>/entries` 会触发两层 loader(`dashboard.tsx` + `dashboard.$slug.tsx` + `dashboard.$slug.entries._index.tsx`),`getUser()` / `requireRole()` 都会再读 sessions/users/memberships。集中化后多了一次 layout loader 但减少了子路由内的 `getTheme`+`getUser`。

[Mitigation]

- React Router 7 默认 loader 并行执行,layout + child loader 是 parallel 不是 sequential
- 让 `requireUser` 共享缓存:`getUserId(request)` 已经在内部读 cookie,session 解码不重复
- 即使每层多一次 DB query,SQLite + WAL,本地查询 < 1ms,可接受

### R2. 五页 UI 重写引入回归

[Risk] 表格、表单交互重写可能破坏现有功能(如 members 行内角色切换的 fetcher 调用、settings 同时支持 update / create-token / revoke / delete 四种 intent)。

[Mitigation]

- 不改 loader / action 任何代码,只换 view 层组件
- 按页面分独立 commit,每页改完手测一次再继续下一页
- 现有集成测试覆盖 loader / action,UI 重写不应影响测试结果(若测试挂,说明动到了不该动的)

### R3. gray-matter 依赖膨胀

[Risk] 引入新依赖,bundle 会变大;但 gray-matter 仅在 server-side `app/lib/docs.ts` 用到,React Router 会自动 tree-shake 出 client bundle。

[Mitigation]

- 只在 `app/lib/docs.ts` 内 `import matter from 'gray-matter'`,不进 client 代码路径
- build 后用 `pnpm -F i18n-studio build` 检查 client bundle 大小不变化

### R4. spec 路径回填可能违反"不改 archive"原则

[Risk] `i18n-studio-locale-management` 与 `i18n-studio-public-shell` 都是 complete 状态但**未 archive**,spec 内容可改;若已 archive 就不能动了。

[Mitigation]

- 实施前再次确认两个 change 仍在 `openspec/changes/` 而不是 `openspec/changes/archive/`
- 仅修改 spec 的 scenario 表述层(`/locales` → `/dashboard/locales`),不改 Requirement 行为

### R5. 命令面板用正则解析路径与未来嵌套路由冲突

[Risk] 如果将来出现 `/dashboard/<slug>/foo/<bar>/baz` 这种深层路径,regex 仍能正确截 slug,但若改 URL 结构(如把 namespace 切到 query string `?ns=foo`)就会失效。

[Mitigation]

- 在 design.md 标注"如果未来重构 dashboard 路径,需同步更新 root.tsx 的 currentSlug regex"
- 长期看应该用 `useMatches()` 在客户端取 `params.slug`,留作未来优化

## Migration Plan

### 部署步骤

本 change 是纯前端 / 文档变更,无 schema 变更、无 API 变更:

1. 一次性 deploy(无两阶段切换需求)
2. 部署后:
   - `pnpm -F i18n-studio build` → 生成新 client bundle
   - `pnpm -F i18n-studio start` 直接重启,无 migration 步骤

### 测试与验证序列

```
1. unit + integration tests (vitest)
   ├── 必须维持 128 通过(可能 +1-2 条 layout 单测)
   └── 若失败:说明改了不该改的服务层

2. typecheck
   └── react-router typegen 会因 dashboard.tsx outlet ctx 变化而重新生成 +types/dashboard

3. lint (oxlint via pnpm)
   └── 维持 0 errors

4. manual smoke (开发机)
   ├── 登录后 ⌘K → 当前 namespace 出现 Navigate / Entries 搜索可用
   ├── 编辑 entry 一条 draft → 在编辑页点 publish/discard,无整页 reload,版本数据自动刷新
   ├── /dashboard/<slug>/sync /tasks /members /settings 视觉与 entries 列表一致
   ├── /dashboard/<slug>/entries/<key>/history 用 shadcn Table 渲染
   ├── /dashboard/locales 禁用 builtin locale 出现 Dialog 二次确认
   └── /dashboard/<slug>/settings 创建 readonly token,明文出现 Copy 按钮
```

### 回滚

按 `proposal.md` 回滚计划分模块 revert,最小粒度是单个 commit。

## Open Questions

无。所有 D1-D8 已在 Decisions 段落定调。本 change 实施期间若遇到子项决策(例如某个表格列宽 / 色彩搭配)直接按"对齐 entries 列表"原则处理,不再回头加 design 节。
