## 1. P0 死链 / Bug 修复

- [x] 1.1 修 `app/root.tsx` `currentSlug` 正则:`/^\/ns\/([^/]+)/` → `/^\/dashboard\/([^/]+)/`,确保 root loader 在 `/dashboard/<slug>/...` 下能解析出 currentSlug
- [x] 1.2 修 `app/routes/dashboard.$slug.entries.$key._index.tsx` 的 `PublishDraftRow`:在文件顶部 import `useRevalidator`,把 `window.location.reload()` 改为 `revalidator.revalidate()`,与 `history.tsx` 写法一致
- [ ] 1.3 在浏览器手动验证(开发服务):
  - 1.3.1 登录后 `⌘K` 在 `/dashboard/<slug>/...` 下可见 Navigate 分组与 Entries 搜索
  - 1.3.2 entry 编辑页点 publish/discard 后无整页刷新,版本号自动更新

## 2. spec 路径回填(归档前清理)

- [x] 2.1 把 `openspec/changes/i18n-studio-locale-management/specs/i18n-locale-management/spec.md` 中所有 `/locales` → `/dashboard/locales`,共 4 处(Requirement 描述 + 3 个 Scenario)
- [x] 2.2 grep 复检 `openspec/changes/i18n-studio-locale-management/` 与 `openspec/changes/i18n-studio-public-shell/` 内 `/ns/` 与 `/locales` 字面量,排除"原 ..."这类历史描述,其它命中点全部回填
- [x] 2.3 `openspec validate i18n-studio-locale-management --strict` 与 `openspec validate i18n-studio-public-shell --strict` 都通过

## 3. dashboard layout 集中托管 user/theme

- [x] 3.1 改写 `app/routes/dashboard.tsx`:
  - 3.1.1 loader 调 `requireUser(request)` + `getTheme(request)`,返回 `{ user, theme }`
  - 3.1.2 `<Outlet context={{ user, theme }} />` 把数据下发(`AppShellFooter` 保留在 layout 末尾)
  - 3.1.3 顶层 `div className="flex min-h-screen flex-col bg-muted/20"` 保留
- [x] 3.2 在 `dashboard.tsx` 文件内 export `DashboardContext` interface,供子路由 `useOutletContext<DashboardContext>()` 使用
- [x] 3.3 改写 `app/routes/dashboard._index.tsx`:删除 loader 内 `requireUser` / `getTheme`,改 `useOutletContext<DashboardContext>()`;loader 仅返回 `{ namespaces: listNamespaces(...) }`(需要 user.id,从 outlet 拿)。注意 loader 在 SSR 仍需读 user,处理方案:loader 调 `getUserId(request)` 直接拿 id(不再 fetch user 全量)+ outlet ctx 拿 user 详情
- [x] 3.4 改写 `app/routes/dashboard.new.tsx`:相同模式;loader 仅返回 `{ localeOptions, defaultSelected }`(去掉 user / theme),组件读 outlet ctx
- [x] 3.5 改写 `app/routes/dashboard.locales.tsx`:相同模式;loader 仅返回 `{ locales: listLocales() }`(action 内仍调 `requireUser` 做权限校验,这是必须的)
- [x] 3.6 `app/routes/dashboard.$slug.tsx`:不动 loader(它有自己的 `requireRole` 与 namespace 数据需求),组件读 outlet ctx 拿 user/theme(原本已在 ctx.user / getTheme,改成从 dashboard outlet 取)。注意:react-router 的 outlet ctx 默认只透传一层,`dashboard.$slug.tsx` 仍要用 `useOutletContext<DashboardContext>()` 取 user/theme,然后再嵌套自己的 NsContext 给孙级
- [x] 3.7 跑 `pnpm -F i18n-studio typecheck`,react-router typegen 会基于新 layout 重生成 `+types/dashboard.*`;修复任何 TS 报错
- [x] 3.8 新增/扩展 `tests/unit/dashboard-layout.test.ts`:
  - 3.8.1 已有"匿名访问 `/dashboard/anything` 重定向 `/login`"用例保留
  - 3.8.2 新增"layout loader 返回 user / theme,子路由可读"测试

## 4. 后台五页 UI 现代化

### 4.1 sync 页

- [x] 4.1.1 改写 `app/routes/dashboard.$slug.sync.tsx`:用 `Card` 包裹外层
- [x] 4.1.2 源命名空间选择改 shadcn `Select`(替代 `<select>`)
- [x] 4.1.3 策略选择改 shadcn `Select`
- [x] 4.1.4 locales 输入改用 `LocaleMultiSelect`,可选项来自当前 namespace 的 locales(从 outlet ctx 取)
- [x] 4.1.5 `autoPublish` 与 `dryRun` 改 shadcn `Switch`(若 `app/components/ui/` 无 `switch.tsx`,先按 shadcn 默认实现添加)
- [x] 4.1.6 sync 结果用 `Card` + `<pre>` 展示;错误用 `<p className="text-destructive">`

### 4.2 tasks 页

- [x] 4.2.1 改写 `app/routes/dashboard.$slug.tasks.tsx`:列表用 shadcn `Table`
- [x] 4.2.2 状态列用 `<Badge variant="...">`(pending=secondary、in_progress=default、completed=success、failed/cancelled=destructive)
- [x] 4.2.3 创建任务 form:targetLocales 改 `LocaleMultiSelect`,`prefix` / `missingLocale` 仍是 `Input`
- [x] 4.2.4 取消按钮改成在 row 末尾的 ghost button + lucide icon
- [x] 4.2.5 进度列用 `<Progress />`(若 `ui/progress.tsx` 无,简化为文本 `{done}/{total}`)

### 4.3 members 页

- [x] 4.3.1 改写 `app/routes/dashboard.$slug.members.tsx`:列表用 shadcn `Table`
- [x] 4.3.2 角色 inline 切换:把原生 `<select>` 改 shadcn `Select`,`onValueChange` 调 `fetcher.submit`
- [x] 4.3.3 邀请表单的角色选择同样改 `Select`
- [x] 4.3.4 移除按钮已经是 Dialog 二次确认,保留;视觉与其它页面对齐(右对齐 ghost button)

### 4.4 settings 页

- [x] 4.4.1 改写 `app/routes/dashboard.$slug.settings.tsx`:外层用 `Card` 替换裸 `<section>`
- [x] 4.4.2 publicRead checkbox → shadcn `Switch`,需要把 hidden input 序列化值
- [x] 4.4.3 token scope `<select>` → shadcn `Select`
- [x] 4.4.4 token 列表用 shadcn `Table`,scope 用 `Badge`,状态(active/revoked)用 `Badge`
- [x] 4.4.5 新建 token 后明文展示区:
  - 4.4.5.1 用 `Card` 替换裸 `<p>`,加 lucide `Copy` 图标按钮
  - 4.4.5.2 onClick 调 `navigator.clipboard.writeText(plaintext)`
  - 4.4.5.3 成功 `toast.success('已复制到剪贴板')`,失败 `toast.error('复制失败,请手动选择')`

### 4.5 entries history 页

- [x] 4.5.1 改写 `app/routes/dashboard.$slug.entries.$key.history.tsx`:7 列表格改 shadcn `Table`
- [x] 4.5.2 status 列改 `Badge` 替代 `StatusBadge` 自写组件(可保留命名,内部改用 Badge variants)
- [x] 4.5.3 locale 筛选行的 `<a>` 改 `Button variant="outline" size="sm"` + `Link asChild`
- [x] 4.5.4 row actions 已有 `Button`,保持

### 4.6 entries.$key._index 页(轻度 polish)

- [x] 4.6.1 已在 1.2 替换 reload。本节再追加:外层用 `Card` 包裹基本信息(key + description + 历史链接)
- [x] 4.6.2 多 locale 编辑框已有 `<div className="rounded-md border p-3">`,改 `Card` 是不是过度?保持现状,只把 `<a>` 历史链接改 `Button asChild variant="link"`

## 5. UX 微项

- [x] 5.1 entries 列表批量删除 / discard 改并发:
  - 5.1.1 `dashboard.$slug.entries._index.tsx:184-193` 的 `for ... await` 串行 → `Promise.allSettled`
  - 5.1.2 同样改 `dashboard.$slug.entries._index.tsx:166-183` discard 循环
  - 5.1.3 失败 toast 汇总:`已删除 X / 失败 Y`
- [x] 5.2 `getNamespaceLocales` parse 一次:
  - 5.2.1 在 entries 列表 loader 内已经 parse,确认组件接收的是 `string[]` 而非 raw JSON(无须改 loader,只需检查传递)
  - 5.2.2 entries 编辑页 / history 页 loader 同样确保已 parse
- [x] 5.3 dashboard.locales builtin 禁用二次确认:
  - 5.3.1 在 `dashboard.locales.tsx` 内新增 `disableConfirm` state(类似 `deleteTarget` 模式)
  - 5.3.2 builtin locale 行的"禁用"按钮 onClick 不直接 submit,而是 `setDisableConfirm({ row })`
  - 5.3.3 渲染 `Dialog`:title "禁用 X?" + description "禁用后,新建 namespace 默认会无 X 可选,确认?"
  - 5.3.4 仅当 Dialog 内点确认才 submit toggle
- [x] 5.4 docs.ts frontmatter 解析换 gray-matter:
  - 5.4.1 `pnpm -F i18n-studio add gray-matter`
  - 5.4.2 `app/lib/docs.ts` 删除自写 `extractFrontmatter`,改 `import matter from 'gray-matter'` + `const { data, content } = matter(raw)`
  - 5.4.3 类型层 `DocFrontmatter` 改读 `data.title` / `data.description`(都是 unknown,做 string 收敛)
  - 5.4.4 跑 `pnpm -F i18n-studio build`,确认 docs 页面渲染无回归

## 6. tasks.md 状态收口

- [x] 6.1 在 `openspec/changes/i18n-studio-modernization/tasks.md` 末尾追加一节
- [x] 6.2 在 `openspec/changes/i18n-studio-public-shell/tasks.md` 末尾追加一节

## 7. 测试与验证

- [x] 7.1 `pnpm -F i18n-studio typecheck` 通过(react-router typegen 应自动跟进 dashboard layout 改动)
- [x] 7.2 `pnpm -F i18n-studio test` 全绿:期望 128 + 新增 1-2 条 layout 单测,共 ~130(实际 129)
- [x] 7.3 `pnpm exec oxlint lint packages/apps/i18n-studio/app` 不引入新 warning
- [x] 7.4 `pnpm -F i18n-studio build` 通过,client bundle 大小变化在 ±5KB 以内(gray-matter 仅 server)
- [ ] 7.5 浏览器烟测(开发服务):
  - 7.5.1 `/` landing → `⌘K` → Switch namespace / Theme / Help / Open docs 都可点
  - 7.5.2 登录 → `/dashboard/<slug>/entries` → `⌘K` → 出现 Navigate 分组,搜索"home."能 fetch entries
  - 7.5.3 编辑 entry 内 publish 一条 draft → 无整页刷新,行内状态从 "draft v3" 变为 "published v3"
  - 7.5.4 `/dashboard/<slug>/sync` 视觉:Select / Switch / LocaleMultiSelect 与 entries 列表 shadcn 视觉密度一致
  - 7.5.5 `/dashboard/<slug>/tasks` `/dashboard/<slug>/members` `/dashboard/<slug>/settings` 同上
  - 7.5.6 `/dashboard/<slug>/entries/<key>/history` 表格用 shadcn `Table`,Badge 状态颜色正确
  - 7.5.7 `/dashboard/locales` 禁用 builtin locale 出现 Dialog 二次确认
  - 7.5.8 `/dashboard/<slug>/settings` 创建 token 后明文有 Copy 按钮,点击 toast "已复制"
- [x] 7.6 `openspec validate i18n-studio-cleanup-and-polish --strict` 通过
- [x] 7.7 `pnpm format:write` 后差异 review

## 8. 收尾

- [x] 8.1 README.md 增补一段:命令面板 ⌘K 在 `/dashboard/...` 下可用、搜索词条
- [ ] 8.2 提交按子模块拆 commit
- [ ] 8.3 准备 archive:运行 `openspec archive i18n-studio-cleanup-and-polish`(实施完成后)
