## 1. 应用脚手架

- [x] 1.1 在 `packages/apps/i18n-studio/` 初始化 React Router v7 项目结构（`app/`、`public/`、`vite.config.ts`、`react-router.config.ts`、`tsconfig.json`）
- [x] 1.2 编写 `package.json`：scripts (`dev`/`build`/`start`/`typecheck`/`db:generate`/`db:migrate`)，依赖 `react-router`、`@react-router/node`、`@react-router/serve`、`better-sqlite3`、`drizzle-orm`、`drizzle-kit`、`zod`、`argon2`、`ulid`、`tailwindcss`、`shadcn/ui` 相关
- [x] 1.3 在根 `pnpm-workspace.yaml` 的 `allowBuilds` 增加 `better-sqlite3`；运行 `pnpm install` 验证安装
- [x] 1.4 复制 `react-app` 的 Tailwind 与 shadcn/ui 基础（`components.json`、`globals.css`、`cn()` util），按需精简组件
- [x] 1.5 在 `i18n-studio/.gitignore` 忽略 `data/`、`drizzle/.cache/`；在仓库根 `.gitignore` 已忽略 `node_modules`，无需重复

## 2. 数据库与迁移

- [x] 2.1 编写 `app/db/schema.ts`：定义 `users / namespaces / memberships / entries / translations / translation_versions / translation_tasks / translation_task_items / api_tokens` 9 张表（含 unique、check、外键 cascade）
- [x] 2.2 编写 `drizzle.config.ts` 指向 `./drizzle` 输出目录，dialect=`sqlite`
- [x] 2.3 跑 `pnpm -F i18n-studio db:generate` 产出初始迁移 SQL，纳入版本控制
- [x] 2.4 编写 `app/lib/db.server.ts`：单例 `better-sqlite3` 连接，启用 WAL，启动时调用 `migrate()` 应用未执行迁移
- [x] 2.5 提供 `app/lib/id.server.ts`：基于 `ulid` 的 ID 生成器

## 3. 校验层

- [x] 3.1 实现 `app/lib/validators.ts`：`localeSchema`、`flatKeySchema`（含具体错误信息）、`roleSchema`
- [x] 3.2 实现 `parseEntries(json)`：导入 JSON 格式校验，返回 `{ ok, errors[] }`
- [x] 3.3 单测：合法/非法 locale、key（空、首尾点、连续点、空白、非法字符、超长）

## 4. 身份与会话

- [x] 4.1 实现 `app/lib/auth.server.ts`：`createCookieSessionStorage`（`SESSION_SECRET` 环境变量），`getUserId(request)`、`requireUser(request)`、`logout(request)`
- [x] 4.2 实现 `loginWithPassword(email,pwd)`：argon2 校验
- [x] 4.3 实现 `registerUser(email,pwd,displayName)`：首位用户注册自动成为系统 superuser（仅记 flag，未来扩展）
- [x] 4.4 实现 `requireRole(request, slug, allowedRoles[])`：返回 `{ user, namespace, role }`，非成员 throw 404 Response，权限不足 throw 403
- [x] 4.5 编写 `app/routes/login.tsx` / `register.tsx` / `logout.tsx`

## 5. Service 层

- [x] 5.1 `services/namespace.server.ts`：`create / list / get / update / delete`（事务）；`update` 支持 `name / default_locale / locales / public_read`，移除 locale 时校验"非 default 且无 published 引用"
- [x] 5.2 `services/membership.server.ts`：`invite / updateRole / remove / list / getRole`，含"最少 1 个 admin"校验
- [x] 5.3 `services/entry.server.ts`：`upsert / get / delete / importFlat`；统一写入入口 `writeTranslation({ entryId, locale, value, source, actorId, status, metadata })`，单事务完成 `translation_versions` insert + 条件 `translations` 指针更新（仅 published） + 条件 `bundle_version+1`（仅当本事务内首次产生 published 写入）
- [x] 5.4 `services/query.server.ts`：`listEntries({ prefix, locale[], view, at_version, group, include, status, page })`；group=key 与 group=locale 共享分页游标；快照视图用 `ROW_NUMBER() PARTITION BY entry_id, locale ORDER BY version DESC` CTE 实现
- [x] 5.5 `services/export.server.ts`：单 locale 平铺 / 多 locale 按 locale 顶层分组 / 支持 `at_version`
- [x] 5.6 `services/version.server.ts`：`listVersions(entryId, locale, cursor)`、`revert(entryId, locale, version, actorId)`（调用 writeTranslation 写 source=revert）
- [x] 5.7 `services/task.server.ts`：`create({ filter?, entry_ids?, target_locales, source_locale? })` 快照 items；`claim(taskId, workerId)` 乐观锁；`writeResults(taskId, items[])` 走 writeTranslation(source=task, status=draft)；`complete / fail / cancel`；`getPayload(taskId)` 返回 flat JSON
- [x] 5.8 `services/sync.server.ts`：`plan({ source, target, prefix?, entry_ids?, locales, strategy, at_version? })` 计算 diff（dry-run）；`apply(plan, auto_publish?)` 事务写入并走 writeTranslation(source=sync, status=draft 或 published)，auto_publish=true 时整次 +1 一次 bundle_version
- [x] 5.9 `services/api-token.server.ts`：生成（`scope ∈ {task, readonly}`，明文一次性返回 + hash + 6 位 prefix）、校验（含 scope 检查）、撤销（写 `revoked_at`）；与 namespace 绑定
- [x] 5.10 `services/publish.server.ts`：`publish(entryId, locale, version, actorId)` / `publishBatch(items[], actorId)` / `discard(entryId, locale, version, actorId)`；publish 共用一次 `bundle_version+1`，discard 不递增
- [x] 5.11 `services/snapshot.server.ts`：`getBundle(slug, { locales?, bundle_version? })` 返回 + ETag(`${bundle_version}-${sortedLocales}-${at??'latest'}`) + Cache-Control；公开/私有分支由 `requireSnapshotAccess` 决定
- [x] 5.12 service 单测覆盖关键路径，含"最少 1 admin"、claim 乐观锁、快照计算、`bundle_version` 并发 +1、locale 移除校验、publish 共用 bundle_version+1

## 6. JSON API 资源路由

- [x] 6.1 `routes/api.namespaces._index.tsx`（POST 创建 / GET 列出）
- [x] 6.2 `routes/api.namespaces.$slug.tsx`（PATCH `name|default_locale|locales|public_read` / DELETE）
- [x] 6.3 `routes/api.namespaces.$slug.members._index.tsx`（POST 邀请 / GET 列表）
- [x] 6.4 `routes/api.namespaces.$slug.members.$userId.tsx`（PATCH 角色 / DELETE 移除）
- [x] 6.5 `routes/api.namespaces.$slug.entries._index.tsx`（GET 列表，支持 `prefix / view=all / locale=a,b / at_version / group=key|locale / include / status / page / cursor`）
- [x] 6.6 `routes/api.namespaces.$slug.entries.$key.tsx`（GET / PUT 含 `as_draft` / DELETE）
- [x] 6.7 `routes/api.namespaces.$slug.entries.$key.versions.tsx`（GET，支持 locale + 分页）
- [x] 6.8 `routes/api.namespaces.$slug.entries.$key.revert.tsx`（POST `{ locale, version }`）
- [x] 6.9 `routes/api.namespaces.$slug.entries.$key.publish.tsx`（POST `{ locale, version }` 单条 publish）
- [x] 6.10 `routes/api.namespaces.$slug.entries.$key.discard.tsx`（POST `{ locale, version }` 丢弃 draft）
- [x] 6.11 `routes/api.namespaces.$slug.publish-batch.tsx`（POST 批量 publish，单事务、共用一次 bundle_version+1）
- [x] 6.12 `routes/api.namespaces.$slug.export.tsx`（GET，单 locale 平铺，多 locale 按 locale 顶层分组，支持 at_version；仅 published）
- [x] 6.13 `routes/api.namespaces.$slug.import.tsx`（POST 含 `as_draft`）
- [x] 6.14 `routes/api.namespaces.$slug.tasks._index.tsx`（POST 创建（含 `filter` / `entry_ids`） / GET 列出）
- [x] 6.15 `routes/api.namespaces.$slug.tasks.$id.tsx`（GET 详情 / DELETE 取消）
- [x] 6.16 `routes/api.tasks.$id.claim.tsx`（POST，scope=task token）
- [x] 6.17 `routes/api.tasks.$id.results.tsx`（POST，scope=task token，批量回写为 draft）
- [x] 6.18 `routes/api.tasks.$id.complete.tsx` / `fail.tsx`（POST，scope=task token）
- [x] 6.19 `routes/api.tasks.$id.payload.tsx`（GET，scope=task token，flat JSON）
- [x] 6.20 `routes/api.namespaces.$targetSlug.sync.tsx`（POST，支持 `prefix / entry_ids / auto_publish / dry_run`）
- [x] 6.21 `routes/api.namespaces.$slug.tokens._index.tsx`（GET 列表 / POST 创建 `scope=task|readonly`，明文仅返回一次）
- [x] 6.22 `routes/api.namespaces.$slug.tokens.$id.tsx`（DELETE 撤销）
- [x] 6.23 `routes/snapshot.$slug._index.tsx`（GET，多 locale，独立路径，ETag/304/`X-Bundle-Version`）
- [x] 6.24 `routes/snapshot.$slug.$locale.tsx`（GET 单 locale 平铺）
- [x] 6.25 统一 JSON 错误格式 `{ code, message, details? }`；中间件分发 cookie session / Bearer (scope=task) / Bearer (scope=readonly)，scope 错路径一律 401

## 7. UI 路由

- [x] 7.1 `routes/_index.tsx`：要求登录；命名空间卡片（参考 ASCII 图 §1）
- [x] 7.2 `routes/ns.$slug._index.tsx`：命名空间概览（语言、词条数、成员数、当前 `bundle_version`、draft 计数）
- [x] 7.3 `routes/ns.$slug.entries.tsx`：词条表格（参考 ASCII 图 §2）
  - [x] 7.3.1 顶部筛选条：`prefix` / `view=all|locale[]` / `at_version` 输入与"Latest"重置 / `include=draft|both` / `status=draft` / "only missing" 切换
  - [x] 7.3.2 复选框列 + 全选；选中数显示 + 批量菜单（Create task / Sync to… / Publish drafts / Discard drafts）
  - [x] 7.3.3 行内多语言编辑面板（按 namespace.locales 渲染；每 locale 显示当前 published version + 是否有 draft；提供 [save (publish)] 与 [save as draft] 双按钮；draft 行显示 [Publish vN] / [Discard vN]）
  - [x] 7.3.4 行级菜单：Edit / History / Publish drafts / Delete
- [x] 7.4 `routes/ns.$slug.entries.$key.history.tsx`：版本列表（标记 ★ current published、status 标记）+ diff 抽屉 + Revert / Publish this version 按钮（参考 ASCII 图 §3）
- [x] 7.5 `routes/ns.$slug.tasks.tsx`：任务列表（状态筛选）+ 详情抽屉/页（进度条、payload 下载、cancel；参考 ASCII 图 §5）
- [x] 7.6 批量选择 → 创建任务对话框（参考 ASCII 图 §4），可由 entries 页或 tasks 页触发；支持 `entry_ids` 与 `filter` 两种来源
- [x] 7.7 `routes/ns.$slug.sync.tsx`：源/前缀/locale/strategy/at_version + Auto-publish + Preview + Apply（参考 ASCII 图 §6a）
- [x] 7.8 Push 对话框组件（参考 ASCII 图 §6b）：Bulk → Sync to… 入口、目标 ns 列表（用户必须 editor+ 才能选）、auto_publish
- [x] 7.9 `routes/ns.$slug.members.tsx`：成员表格、邀请、角色下拉、移除（仅 admin；参考 ASCII 图 §7）
- [x] 7.10 `routes/ns.$slug.settings.tsx`：名称、locale 列表（含移除校验提示）、`public_read` 开关、API token 管理（双 scope）、Danger zone（参考 ASCII 图 §8）
- [x] 7.11 导入/导出按钮：导入弹窗（含 `as_draft` 复选）+ 下载 flat JSON（单/多 locale 自动切换 layout）
- [x] 7.12 全局布局：顶部导航 + 命名空间侧栏（标识 draft 数量）+ Sonner toast
- [x] 7.13 浅色/深色主题（沿用 `react-app` 方案）

## 8. 测试

- [x] 8.1 单测：validators、id 生成、密码哈希、快照 SQL（CTE）、ETag 计算函数
- [x] 8.2 集成测试（vitest + 内存 SQLite）：命名空间 / 成员 / 词条 service
- [x] 8.3 集成测试：权限矩阵（admin/editor/viewer × 各 API 操作 + token 路径 + scope=task / scope=readonly 各自允许 / 拒绝集合）
- [x] 8.4 集成测试：批量导入预校验回滚 + 成功路径 + 10k 上限 + `as_draft` 路径
- [x] 8.5 集成测试：跨命名空间隔离（非成员 → 404）；删除命名空间级联（含 token、task）
- [x] 8.6 集成测试：版本控制（写入版本递增、历史查询、回滚、versions 表 append-only）
- [x] 8.7 集成测试：Publish/Discard（单条 / 批量 / 不存在 draft / 已 discarded 不可 publish；批量 publish 共用一次 `bundle_version+1`）
- [x] 8.8 集成测试：翻译任务生命周期（filter / entry_ids 创建；create → claim → results(draft) → complete / fail / cancel；重复 claim 拒绝；results 不影响 `bundle_version`）
- [x] 8.9 集成测试：跨空间同步三种 strategy + dry-run + entry_ids 白名单 + auto_publish 路径 + 权限矩阵
- [x] 8.10 集成测试：查询视图（view=all / locale 子集 / at_version 快照 / group=key vs group=locale 一致性 / include=draft|both / status=draft / 分页 cursor）
- [x] 8.11 集成测试：导出（单 locale 平铺 / 多 locale 分组 / at_version；仅 published）
- [x] 8.12 集成测试：Snapshot 通道（公开/私有 + readonly token 路径、ETag/304、`?bundle_version=` 固定快照、scope=task token 不可访问 /snapshot、scope=readonly token 不可访问 /api、bundle_version 触发与不触发场景）
- [x] 8.13 集成测试:locale 移除（无引用通过 / 有 published 引用拒 / default_locale 拒）
- [x] 8.14 集成测试：bundle_version 并发 +1（两并发写各自获得不同值，最终值 = 起点 + 2）
- [x] 8.15 端到端冒烟（可选）：`react-router-serve` 起服务，curl 关键 API + curl `/snapshot/...`(改为进程内 service-level smoke,串通 注册→导入→task→publish→snapshot)

## 9. 文档与运行

- [x] 9.1 `packages/apps/i18n-studio/README.md`：开发/构建/部署、env 列表（`SESSION_SECRET`、`DATABASE_FILE`）、备份命令
- [x] 9.2 仓库根 `CLAUDE.md` 追加 `i18n-studio` 应用规范片段（pnpm 命令、目录约定）
- [x] 9.3 提供 seed 脚本：创建初始用户、`docs` 命名空间与示例词条
- [x] 9.4 准备最小 Dockerfile（Node 20 + better-sqlite3 build deps + 持久卷 `/data`）
- [x] 9.5 跑 `pnpm -F i18n-studio build` / `pnpm -F i18n-studio typecheck` / `pnpm lint` 全部通过

## 10. 回滚演练

- [x] 10.1 验证停服后 SQLite 文件可备份与恢复（`.backup` + 文件替换）
- [x] 10.2 验证从 workspace 移除 `i18n-studio` 后其它 app 构建无影响
