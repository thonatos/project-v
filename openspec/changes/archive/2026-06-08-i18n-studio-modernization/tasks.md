## 1. Dockerfile 生产化

- [x] 1.1 将 Dockerfile 中所有 `FROM` 行升级到 `node:24-bookworm-slim`
- [x] 1.2 在 deps stage 写入 `RUN corepack enable && corepack prepare pnpm@11 --activate`，移除 `pnpm@latest`
- [x] 1.3 在 build stage 末尾追加 `RUN pnpm -F i18n-studio deploy --prod /prod`
- [x] 1.4 重写 runtime stage：
  - [x] 1.4.1 仅 `apt-get install ca-certificates`
  - [x] 1.4.2 `COPY --from=build /prod /app`（替代原有多次 `COPY --from`）
  - [x] 1.4.3 `ENV NODE_ENV=production / DATABASE_FILE=/data/i18n.db / PORT=3000`
  - [x] 1.4.4 `RUN mkdir -p /data && chown -R node:node /data /app`
  - [x] 1.4.5 `USER node`
  - [x] 1.4.6 `VOLUME /data` / `EXPOSE 3000`
  - [x] 1.4.7 `CMD ["node", "node_modules/@react-router/serve/dist/cli.js", "./build/server/index.js"]`
- [x] 1.5 在仓库根新增/扩充 `.dockerignore`，至少包含：`**/node_modules`、`**/.git`、`packages/apps/i18n-studio/{data,build,.tmp,.react-router,tests/.tmp}`
- [ ] 1.6 本地烟测：`docker build -f packages/apps/i18n-studio/Dockerfile -t i18n-studio:dev .` → `docker run --rm -p 3000:3000 -v $(pwd)/.tmp-data:/data i18n-studio:dev`，浏览 `/login` 正常加载
- [ ] 1.7 验证 runtime 镜像无 pnpm：`docker run --rm i18n-studio:dev sh -c 'command -v pnpm; echo done'` 输出 `done`，无 pnpm 路径

## 2. 测试目录与 Template DB

- [x] 2.1 新建 `tests/unit/` 与 `tests/integration/` 目录
- [x] 2.2 把 `app/lib/services/snapshot.test.ts` 移动到 `tests/unit/snapshot-etag.test.ts`,把 `app/lib/validators.test.ts` 移动到 `tests/unit/validators.test.ts`,断言不变
- [x] 2.3 改写 `tests/test-db.ts`：
  - [x] 2.3.1 暴露 `buildTemplateDb()` 一次性产出 `tests/.tmp/_template.db`
  - [x] 2.3.2 暴露 `setupTestDbFromTemplate()`：`mkdtempSync` + `copyFileSync` + 设置 `DATABASE_FILE`
  - [x] 2.3.3 旧 `setupTestDb` 兼容期可保留，但内部改走 template 路径
- [x] 2.4 新增 `tests/global-setup.ts`：`async ({ provide }) => { rmSync('tests/.tmp', force); buildTemplateDb(); }`
- [x] 2.5 修改 `vitest.config.ts`：
  - [x] 2.5.1 `test.include = ['tests/**/*.test.{ts,tsx}']`
  - [x] 2.5.2 `test.globalSetup = './tests/global-setup.ts'`
  - [x] 2.5.3 `test.setupFiles = ['./tests/setup.ts']`（保留 ENV 注入）
- [x] 2.6 移动并合并测试文件（用 `git mv` 保留历史）：
  - [x] 2.6.1 `integration.test.ts` + `isolation.test.ts` + `bundle-version.test.ts` → `tests/integration/namespace.test.ts`
  - [x] 2.6.2 `import.test.ts` + `publish.test.ts` + `query.test.ts` → `tests/integration/entry-lifecycle.test.ts`
  - [x] 2.6.3 `task.test.ts` + `sync.test.ts` → `tests/integration/translation-flow.test.ts`
  - [x] 2.6.4 `export.test.ts` + `snapshot-channel.test.ts` → `tests/integration/export-snapshot.test.ts`
  - [x] 2.6.5 `permissions.test.ts` → `tests/integration/permissions.test.ts`
  - [x] 2.6.6 `e2e-smoke.test.ts` → `tests/integration/e2e.test.ts`
- [x] 2.7 把每个集成文件的 `setupTestDb` 调用替换为 `setupTestDbFromTemplate`
- [x] 2.8 跑 `pnpm -F i18n-studio test`，全绿；记录前后耗时（≥ 5× 加速作为期望）
- [x] 2.9 在 i18n-studio `.gitignore` 中确认 `tests/.tmp/` 已被忽略
- [x] 2.10 verify：在 `app/` 全文搜索 `*.test.*` / `*.spec.*` 应为空

## 3. UI 组件库扩充

- [x] 3.1 在 i18n-studio 内运行 shadcn CLI（或手工添加）以下组件至 `app/components/ui/`：`table`、`sheet`、`tabs`、`badge`、`avatar`、`skeleton`、`breadcrumb`、`command`、`separator`、`scroll-area`、`tooltip`、`toggle-group`、`dialog`、`dropdown-menu`
- [x] 3.2 在 `package.json` `dependencies` 增补对应 Radix primitives 与 `cmdk`
- [x] 3.3 `pnpm install` 验证；`pnpm -F i18n-studio typecheck` 通过

## 4. Dark Mode

- [x] 4.1 新建 `app/lib/theme.server.ts`(及 client-safe `app/lib/theme.ts`):暴露 `getTheme(request)`、`createThemeCookie(value)`、`type Theme = 'light' | 'dark' | 'system'`
- [x] 4.2 在 `app/root.tsx` 的 `loader` 中读取 cookie，把 `theme` 传给 Layout；`<html className={theme === 'dark' ? 'dark' : ''}>`
- [x] 4.3 客户端 hook `useSystemThemeSync(theme)`：当 `theme === 'system'` 时监听 `prefers-color-scheme` 同步 className
- [x] 4.4 新增路由 `app/routes/api.theme.tsx`:仅 `action`,校验值并 `Set-Cookie`
- [x] 4.5 新增组件 `app/components/theme-toggle.tsx`:使用 `ToggleGroup` 三档(Sun / Moon / Monitor 图标)
- [x] 4.6 把 toggle 挂到 root header 与命令面板的 "Theme" 分组
- [ ] 4.7 verify:浏览器手动切换 → 刷新仍保留;DevTools 模拟 prefers-color-scheme 变化生效

## 5. 应用 Shell 重做

- [x] 5.1 重写 `app/root.tsx` 的 `Layout`:保留 `<Toaster />`,新增 `<CommandPalette />`、应用主题 className
- [x] 5.2 抽出 `app/components/app-shell.tsx`(header + 主题切换 + 用户菜单)
- [x] 5.3 重写 `app/routes/ns.$slug.tsx`:图标侧栏(lucide)、桌面端两列、移动端 Sheet 抽屉
- [x] 5.4 用 shadcn `Breadcrumb` 替换 header 内的 `slug / 名称` 拼接
- [x] 5.5 用 `DropdownMenu` 替换 header 直接放置的 "Logout" 按钮(含用户邮箱)

## 6. 主战场页面重做

- [x] 6.1 `app/routes/_index.tsx`:卡片网格 + EmptyState(无命名空间时)
- [x] 6.2 `app/routes/ns.$slug._index.tsx`:4 张图标统计卡(Entries / Drafts / Members / Locales)
- [x] 6.3 `app/routes/ns.$slug.entries._index.tsx`:
  - [x] 6.3.1 用 shadcn `Table` 渲染列表
  - [x] 6.3.2 行内编辑改为 `Sheet`(点击行打开侧滑面板) — 当前用 Link 跳详情页 + Push to ▾ 改为 DropdownMenu;Sheet 主要用于移动端侧栏
  - [x] 6.3.3 替换页内 `alert()` / `confirm()` 为 `Dialog` + `sonner` toast
- [x] 6.4 `app/routes/login.tsx` / `register.tsx` / `ns.new.tsx`:统一 logo + 居中 Card + 一致表单密度

## 7. 命令面板(Cmd+K)

- [x] 7.1 新建 `app/components/command-palette.tsx`:`CommandDialog` + 全局 `useEffect` 监听 `⌘K` / `Ctrl+K`
- [x] 7.2 数据源:
  - [x] 7.2.1 命名空间列表来自 root loader 注入的 outlet context(避免重复请求)
  - [x] 7.2.2 当前 ns 内的页面列表静态写死
  - [x] 7.2.3 词条 prefix 搜索使用 `useFetcher` 调用 `GET /api/namespaces/:slug/entries`,250ms 防抖
- [x] 7.3 行动项:Switch namespace → `navigate(...)`;Toggle theme → 调用 `/api/theme`(暂未把 "Publish selected drafts" 加入,因为命令面板与 entries 页 selection 状态不共享;改在 entries 页内提供)
- [x] 7.4 输入框聚焦时不触发全局快捷键(palette 已打开时除外)
- [ ] 7.5 verify:在 `/`、`/ns/:slug/*` 多个页面打开 → 切换 ns、跳转页面、搜索词条均可用

## 8. 页面标题(meta)

- [x] 8.1 为 design 表中所有渲染 HTML 的路由实现 `meta()`(`_index`、`login`、`register`、`ns.new`、`ns.$slug` 系列;snapshot 通道仅返回 JSON,在 spec 中明确无需 meta)
- [x] 8.2 在 `app/root.tsx` 的 `ErrorBoundary` 内根据 status 设置标题(`404 · i18n-studio` / `Error · i18n-studio`)
- [x] 8.3 grep 校验:所有 `app/routes/*.tsx` 中渲染 HTML 的文件都包含 `export function meta`
- [ ] 8.4 浏览器访问每个路由人工校验 `<title>` 与表格一致

## 9. 收尾

- [x] 9.1 `pnpm -F i18n-studio typecheck` 通过
- [x] 9.2 `pnpm -F i18n-studio test` 全绿(96 通过, 6.99s),耗时较改造前下降
- [x] 9.3 `pnpm lint` 通过(0 errors,改造引入的所有 warnings 已清理);提交前跑 `pnpm format:write`
- [ ] 9.4 `docker build` + `docker run` 烟测一次(含主题切换、命令面板、词条列表)
- [x] 9.5 更新 `packages/apps/i18n-studio/README.md`:补充新的运行命令(`docker run`)、命令面板快捷键、主题说明
- [x] 9.6 `openspec validate i18n-studio-modernization --strict` 通过

## 10. 延后到 i18n-studio-cleanup-and-polish

以下 manual smoke 项与未现代化页面已转移到 `i18n-studio-cleanup-and-polish` change 处理:

- 1.6 / 1.7 docker smoke
- 4.7 / 7.5 / 8.4 / 9.4 浏览器手测
- 6.x 主战场页面重做时遗漏的 `sync` / `tasks` / `members` / `settings` / `entries.$key.history` 五个页面
  (modernization 仅完成了 entries 列表 + dashboard overview + login/register/new,见 cleanup-and-polish design.md D3)
