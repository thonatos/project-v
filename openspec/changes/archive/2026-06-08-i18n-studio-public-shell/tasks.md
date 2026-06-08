## 1. Markdown 内容管线(unified)

- [x] 1.1 在 `package.json` `dependencies` 增补 `unified`、`remark-parse`、`remark-gfm`、`remark-frontmatter`、`remark-rehype`、`rehype-highlight`、`rehype-stringify`、`unist-util-visit`;`devDependencies` 增补 `@types/mdast`、`@types/hast`
- [x] 1.2 移除 `@mdx-js/react`(deps)、`@mdx-js/rollup`(devDeps)、`@types/mdx`(devDeps)、`rehype-pretty-code`(devDeps)、`shiki`(devDeps)、`rehype-slug`(devDeps)、`rehype-autolink-headings`(devDeps)
- [x] 1.3 `pnpm install`,确认 lockfile 更新
- [x] 1.4 `vite.config.ts` 移除 `@mdx-js/rollup` 注册与对应 rehype 插件 import,保留 `~openapi` alias
- [x] 1.5 删除 `app/types/mdx.d.ts`(类型声明不再需要)

## 2. Landing 页 `/`

- [x] 2.1 重写 `app/routes/_index.tsx`:loader 读 cookie 判断登录态,但**不**强制 `requireUser`;返回 `{ user: User|null, theme }`
- [x] 2.2 新建 `app/components/landing/landing-header.tsx`:brand + Docs / GitHub 链接 + 登录态 CTA(匿名:Sign in/Sign up;已登录:进入后台);移动端 Sheet 收起
- [x] 2.3 新建 `app/components/landing/hero.tsx`:产品口号 + sub-headline + 双 CTA 按钮(主 = 登录 or 进入后台;次 = 阅读文档)
- [x] 2.4 新建 `app/components/landing/features.tsx`:6 张特性卡片网格(草稿/发布/历史 · 跨空间同步 · 任务化协作 · Snapshot 通道 · 系统级 locale 字典 · 单文件部署),每卡含 lucide icon + 标题 + 简介
- [x] 2.5 新建 `app/components/landing/footer.tsx`:版权 + Docs / OpenAPI / GitHub 链接
- [x] 2.6 在 `_index.tsx` 中组合上述 4 个模块,设置 meta title/description
- [x] 2.7 视觉烟测:桌面 / 移动 视口下 hero / features / footer 不溢出;深浅色主题切换正确

## 3. 后台搬迁到 `/dashboard/**`

- [x] 3.1 新建受保护 layout `app/routes/dashboard.tsx`:loader 调 `requireUser` + `getTheme`,渲染 `<Outlet />`;没有自己的 UI(由子页继续挂 `AppShellHeader`)
- [x] 3.2 把原 `_index.tsx` 的"namespace 列表"逻辑迁到新建的 `app/routes/dashboard._index.tsx`,loader 不再自己 `requireUser`(由 layout 负责);原 `_index.tsx` 已在 2.1 重写为 landing,本步不再 git mv
- [x] 3.3 `git mv app/routes/ns.new.tsx app/routes/dashboard.new.tsx`,移除内部 `requireUser` 调用,内部链接 `/ns/...` → `/dashboard/...`
- [x] 3.4 `git mv app/routes/ns.$slug.tsx app/routes/dashboard.$slug.tsx`,同上
- [x] 3.5 `git mv app/routes/ns.$slug._index.tsx app/routes/dashboard.$slug._index.tsx`
- [x] 3.6 `git mv app/routes/ns.$slug.entries._index.tsx app/routes/dashboard.$slug.entries._index.tsx`
- [x] 3.7 `git mv app/routes/ns.$slug.entries.$key._index.tsx app/routes/dashboard.$slug.entries.$key._index.tsx`
- [x] 3.8 `git mv app/routes/ns.$slug.entries.$key.history.tsx app/routes/dashboard.$slug.entries.$key.history.tsx`
- [x] 3.9 `git mv app/routes/ns.$slug.members.tsx app/routes/dashboard.$slug.members.tsx`
- [x] 3.10 `git mv app/routes/ns.$slug.settings.tsx app/routes/dashboard.$slug.settings.tsx`
- [x] 3.11 `git mv app/routes/ns.$slug.sync.tsx app/routes/dashboard.$slug.sync.tsx`
- [x] 3.12 `git mv app/routes/ns.$slug.tasks.tsx app/routes/dashboard.$slug.tasks.tsx`
- [x] 3.13 `git mv app/routes/locales.tsx app/routes/dashboard.locales.tsx`,移除内部 `requireUser`
- [x] 3.14 在所有 dashboard.* 子路由中:
  - 删除 `requireUser` 调用(layout 已统一负责)
  - 把内部硬编码字符串 `/ns/...` 替换为 `/dashboard/...`
  - 把面包屑 `{ label: 'Namespaces', to: '/' }` 改为 `{ label: 'Namespaces', to: '/dashboard' }`
- [x] 3.15 修改 `app/routes/login.tsx`:`loginAndCreateSession(user.id, '/dashboard')`,`if (userId) throw redirect('/dashboard')`
- [x] 3.16 修改 `app/routes/register.tsx`:同上
- [x] 3.17 修改 `app/routes/logout.tsx`:`throw redirect('/')`(回到 landing,而非 `/login`)
- [x] 3.18 修改 `app/lib/auth.server.ts`:`loginAndCreateSession` 默认 `redirectTo` 改为 `/dashboard`
- [x] 3.19 修改 `app/components/command-palette.tsx`:全部 `/ns/${slug}` → `/dashboard/${slug}`,`/ns/new` → `/dashboard/new`,`/locales` → `/dashboard/locales`
- [x] 3.20 修改 `app/components/app-shell.tsx`:`/locales` 链接 → `/dashboard/locales`;新增 `homeHref` prop(默认 `/dashboard`,landing/docs 中传 `/`)
- [x] 3.21 修改 `app/components/locale-multi-select.tsx`:`/locales` → `/dashboard/locales`
- [x] 3.22 修改 `app/lib/services/namespace.server.ts:56`:错误信息 "请先在 `/locales` 中添加 locale" → "`/dashboard/locales`"
- [x] 3.23 修改 `app/scripts/repair-locales.ts`:升级提示中的 `/locales` 字面量 → `/dashboard/locales`
- [x] 3.24 测试登录 → 落到 `/dashboard`;访问 `/dashboard/...` 任意子路由匿名重定向 `/login`

## 4. 旧路径处理(已废弃,不做兼容 redirect)

- [x] 4.1 直接删除 `app/routes/ns.$.tsx` 与 `app/routes/locales.tsx` 残留,旧 `/ns/*` 与 `/locales` 不保留 redirect

## 5. 文档基础设施

- [x] 5.1 新建 `app/lib/docs.ts`:从 `app/docs/*.md` 读取 + unified pipeline,导出 `Doc` interface、`getDocBySlug`、`getDocSlugs`、`getDocsInOrder`(按 `['index','guide','api','deployment','changelog']` 顺序);frontmatter 仅识别 `title` / `description`
- [x] 5.2 docsDir 用 `path.join(process.cwd(), 'app/docs')`,与 docs-app 同款方案;build 期 `pnpm -F i18n-studio build` cwd 为该包目录
- [x] 5.3 (取消)~~mdx-components 与自渲染 OpenAPI 组件不再需要~~

## 6. 文档路由与 layout

- [x] 6.1 重写 `app/routes/docs.tsx`:layout 路由,loader 返回 `{ theme, user, sidebar }`,sidebar 由 `getDocsInOrder()` 派生;移动端 Sheet trigger 复用,匿名可访问
- [x] 6.2 新建 `app/components/docs/docs-sidebar.tsx`:接受 `SidebarItem[]` props,使用 `NavLink` + 内联 active 状态(`isActive ? 'bg-accent ...' : '...'`)
- [x] 6.3 新建 `app/routes/docs._index.tsx`:loader 调 `getDocBySlug('index')`,组件渲染 `loaderData.content` HTML 字符串
- [x] 6.4 新建 `app/routes/docs.$slug.tsx`:loader 调 `getDocBySlug(params.slug)`,未匹配 `throw new Response('Not Found', { status: 404 })`;统一处理 `/docs/guide` / `/docs/api` / `/docs/deployment` / `/docs/changelog`
- [x] 6.5 (取消)~~docs.guides.$slug.tsx / docs.api.$resource.tsx / docs.deployment.tsx / docs.changelog.tsx~~ — 由 `docs.$slug.tsx` 统一处理
- [x] 6.6 (取消)~~docs[.openapi.json].tsx 资源路由~~ — `public/openapi.json` 由 vite/react-router public 静态资源直接提供,通过 `GET /openapi.json` 暴露
- [x] 6.7 修改 `react-router.config.ts`:`async prerender()` 调 `getDocSlugs()` 动态生成 `/docs` + 每个非 index slug 的 `/docs/<slug>` 列表

## 7. OpenAPI 数据真相

- [x] 7.1 `public/openapi.json` 骨架:`info`、`servers`、`tags`、`components.securitySchemes`(cookieSession / taskBearer / readonlyBearer)
- [x] 7.2 在 `components.schemas` 内定义复用 schema:`Namespace`、`Entry`、`Translation`、`TranslationVersion`、`TranslationTask`、`TranslationTaskItem`、`ApiToken`、`Locale`、`ApiError`、`Membership`
- [x] 7.3 在 `components.responses` 内定义统一错误响应,涵盖错误码:`invalid_json` / `unsupported_media_type` / `forbidden` / `not_found` / `validation_error` / `locale_not_found` / `locale_disabled` / `locale_in_use` / `locale_builtin_undeletable` / `locale_dictionary_empty`
- [x] 7.4 为以下路由全部填写 operation:namespaces / entries / versions / import-export / members / tokens / tasks / sync / snapshot
- [x] 7.5 跑 `node -e 'JSON.parse(require("fs").readFileSync("public/openapi.json","utf8"))'` 验证 JSON 合法
- [x] 7.6 用 `tests/unit/openapi-shape.test.ts` 与 `scripts/check-openapi-coverage.mjs` 校验文档结构与覆盖度

## 8. 文档内容(Markdown)

- [x] 8.1 `app/docs/index.md` — 总览 + 角色导航
- [x] 8.2 `app/docs/guide.md` — 综合指南:合并旧 6 篇 guides(快速开始 / 词条工作流 / 翻译任务 / 跨空间同步 / Snapshot 消费 / Locale 字典),保留 worker 伪代码、ETag 客户端示例、strategy 表
- [x] 8.3 `app/docs/api.md` — API 参考:鉴权 / 错误格式 / 路径前缀 / tags 分组 + 几个常用 curl 例子;详细 endpoint 字段统一引用 `/openapi.json`
- [x] 8.4 `app/docs/deployment.md` — Docker 启动 / 环境变量 / 卷 / 升级 / 反向代理 / 健康检查
- [x] 8.5 `app/docs/changelog.md` — modernization / locale-management / public-shell 的 release note(public-shell 段更新到 unified pipeline 现状)

## 9. 全局导航接入

- [x] 9.1 `app/components/app-shell.tsx`:在 brand 与右侧操作区之间加 `<Link to="/docs">Docs</Link>`(`hidden md:inline-flex`),匿名也显示;新增 `homeHref` prop(默认 `/dashboard`,landing/docs 中传 `/`)
- [x] 9.2 `app/components/landing/landing-header.tsx`:同样含 Docs 链接(2.2 已含,这里复核)
- [x] 9.3 命名空间页 `Sheet` 抽屉(各 `dashboard.$slug.*` 使用 leadingSlot 的页面)在 nav 末尾追加 `Docs` 项
- [x] 9.4 `app/components/command-palette.tsx`:加 "Help" 分组,内含 "Open docs"(`navTo('/docs')`),所有用户可见
- [x] 9.5 docs 页面内的 layout sidebar 与 namespace 内 sidebar 视觉风格一致,但导航项独立(不混入)

## 10. 测试

- [x] 10.1 (取消)~~docs-registry.test.ts~~ — registry 已删除,测试随之移除
- [x] 10.2 `tests/unit/openapi-shape.test.ts`:静态读取 `public/openapi.json`,断言 `info.title` / `paths` 至少含若干预期 path;每个 operation 都有 `operationId` / `responses`
- [x] 10.3 (取消)~~redirects.test.ts~~ — 旧路径不做兼容 redirect,该测试已删除
- [x] 10.4 `tests/unit/landing-loader.test.ts`:loader 不调 `requireUser`,匿名 200,已登录返回 user 对象
- [x] 10.5 `tests/unit/dashboard-layout.test.ts`:匿名访问 `/dashboard/anything` 重定向 `/login`;已登录访问 200
- [x] 10.6 验证脚本:`scripts/check-openapi-coverage.mjs` 列出 `app/routes/api.*` 与 `snapshot.*`,与 `public/openapi.json` 中 path 集合做差,差集为空
- [x] 10.7 跑完整 `pnpm -F i18n-studio test`,确认无回归

## 11. 收尾

- [x] 11.1 `pnpm -F i18n-studio typecheck` 通过
- [x] 11.2 `pnpm -F i18n-studio test` 全绿
- [x] 11.3 `pnpm -F i18n-studio build` 通过(MDX 编译期产出 + 高亮 inline)
- [x] 11.4 `pnpm exec oxlint lint packages/apps/i18n-studio/app` 仅有改造前已存在的 warning
- [x] 11.5 `pnpm format:write`
- [x] 11.6 README.md 增加一段:"在线文档参见 `/docs`,OpenAPI 见 `/docs/openapi.json`"
- [x] 11.7 浏览器烟测:
  - [x] 11.7.1 匿名访客访问 `/` 见 landing,不被重定向
  - [x] 11.7.2 匿名访问 `/docs` 各页面均可见,header `Docs` 链接显示
  - [x] 11.7.3 已登录访问 `/` header CTA 显示「进入后台」
  - [x] 11.7.4 登录后跳到 `/dashboard`,功能与原 `/` namespace 列表等同
  - [x] 11.7.5 旧链接 `/ns/foo/entries` 直接 404(已不做兼容 redirect,符合预期)
  - [x] 11.7.6 切换 Light/Dark 后 landing/docs 代码高亮跟随
  - [x] 11.7.7 命令面板可跳 `/docs`
  - [x] 11.7.8 `/openapi.json` 返回合法 JSON,可在 Postman 导入
- [x] 11.8 `openspec validate i18n-studio-public-shell --strict` 通过

## 12. docs 重构(mdx-js → unified pipeline + prerender)

- [x] 12.1 移除 mdx-js 系列依赖(`@mdx-js/react` / `@mdx-js/rollup` / `@types/mdx`)与 `rehype-pretty-code` / `shiki` / `rehype-slug` / `rehype-autolink-headings`
- [x] 12.2 增补 unified / remark / rehype 系列依赖至 `dependencies`,`@types/mdast` / `@types/hast` 至 `devDependencies`
- [x] 12.3 `vite.config.ts` 移除 mdx 插件;保留 `~openapi` alias
- [x] 12.4 删除 `app/docs/`(含 17 个 .mdx、`registry.ts`、`mdx-components.tsx`、`components/` 全部)与 `app/types/mdx.d.ts`
- [x] 12.5 删除旧路由:`docs._index.tsx`(原 mdx 版)、`docs.guides.$slug.tsx`、`docs.api.$resource.tsx`、`docs.deployment.tsx`、`docs.changelog.tsx`;原 `app/components/docs-sidebar.tsx` 移入 `app/components/docs/docs-sidebar.tsx` 并改为接收 props
- [x] 12.6 新建 `app/lib/docs.ts`:unified pipeline + 简化 frontmatter(`title` / `description`),导出 `getDocBySlug` / `getDocSlugs` / `getDocsInOrder`(按 `['index','guide','api','deployment','changelog']` 顺序)
- [x] 12.7 新建 5 篇 markdown:`app/docs/{index,guide,api,deployment,changelog}.md`(由原 17 篇 mdx 合并简化;Endpoint / ParamTable / Callout / HttpBadge 等组件统一改写为 markdown 表格 / blockquote / inline code,API 详情链接 `/openapi.json`)
- [x] 12.8 新建 `app/components/docs/docs-sidebar.tsx`(props 化)与 `app/routes/docs._index.tsx`、`app/routes/docs.$slug.tsx`(loader 调 `getDocBySlug`,组件渲染 HTML 字符串)
- [x] 12.9 重写 `app/routes/docs.tsx`:loader 增加 `getDocsInOrder()` 派生 sidebar 数据,移除 `MDXProvider` 与 `mdxComponents`;`AppShellHeader` 与 `Sheet` 移动端触发器保留
- [x] 12.10 `react-router.config.ts`:`async prerender()` 调 `getDocSlugs()` 动态生成 `/docs` + `/docs/<slug>`;build 期产出 `/docs` / `/docs/guide` / `/docs/api` / `/docs/deployment` / `/docs/changelog` 静态 HTML
- [x] 12.11 `tests/unit/docs-registry.test.ts` 删除(registry 已不存在)
- [x] 12.12 `pnpm -F i18n-studio typecheck` / `test` / `build` 全绿
- [x] 12.13 同步本 change 的 spec / proposal / design / tasks(本节)

## 13. 备注

- 任务 2.2 / 2.5 描述的 `landing-header.tsx` / `landing-footer.tsx` 实际复用了
  `app/components/app-shell.tsx`(`AppShellHeader`)与 `app/components/app-shell-footer.tsx`(`AppShellFooter`),
  而非新建独立组件。这是合理的复用决策(二者结构 90%+ 重合,`landing-header` 仅在登录态切换 CTA 文案)。
  详见 `i18n-studio-cleanup-and-polish` design.md。
- 任务 3.x 中提到的"内部硬编码字符串 `/ns/...` 替换为 `/dashboard/...`"在 root.tsx 命令面板
  `currentSlug` 解析处遗漏(原正则 `^/ns/`),已在 `i18n-studio-cleanup-and-polish` 修复。
- 任务 11.7.5 旧 `/ns/*` 路径不做兼容 redirect,确认行为符合预期。
