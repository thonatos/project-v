# Design — i18n-studio Modernization

本 design 聚焦三块优化中需要权衡的关键决策与约束，**不重复 proposal 中已写明的范围**。

## A. Dockerfile 决策

### A.1 基础镜像选择 `node:24-bookworm-slim`

- 选 `bookworm-slim` 而不是 `alpine`：`better-sqlite3` 是 native 模块，使用 glibc 比 musl 兼容性更稳，避免进入 alpine 后陷入 native 编译/加载差异
- 选 `slim` 而不是 fat：build 阶段才装 `python3 / make / g++`；runtime 镜像只需 `ca-certificates`
- 不固定到具体补丁版本（如 `24.1.0`）：跟随 base 镜像安全更新；如团队后续需要严格复现，再补 SHA256

### A.2 pnpm 版本固定到 `pnpm@11`

- **不**在 root `package.json` 添加 `packageManager` 字段（用户明确否决）
- Dockerfile 内写死 `corepack prepare pnpm@11 --activate`
- 仅锁大版本，允许小版本随上游 patch 漂移；确实需要严格复现时再细化

### A.3 build 产物剥离 — `pnpm deploy --prod`

- React Router v7 build 产物只是 `build/server/` + `build/client/` JS bundle，仍依赖 `node_modules` 中的运行时（`@react-router/serve`、`react-router`、`better-sqlite3` native 等）
- `pnpm deploy --prod /prod` 会产出一个独立目录，包含：
  - 仅 `dependencies` 中声明的包（剔除 `devDependencies`）
  - 应用代码与构建产物（按当前 workspace 包内容拷贝）
- runtime stage 只 `COPY --from=build /prod` 即可，不再需要 `pnpm install --prod` 也不再需要 `pnpm` 本身
- 替代方案 `pnpm install --prod`：仍需要 pnpm CLI、对 workspace 仓库要在 build 阶段重复算依赖图，慢且复杂

### A.4 运行用户与卷

- `node:24-bookworm-slim` 镜像内置 `node` 用户与组（uid/gid 1000）
- runtime stage 在 USER 切换前 `mkdir -p /data && chown -R node:node /data /app`
- `VOLUME /data` 仅声明语义，不依赖宿主一定挂载（不挂载时数据落镜像层，重启即失，与 sqlite 单文件特性一致）

### A.5 不引入的东西

| 元素 | 决策 | 理由 |
| ---- | ---- | ---- |
| `HEALTHCHECK` | 不加 | 用户决策 #4 |
| `/healthz` 路由 | 不加 | 用户决策 #4，编排层（Compose/Nomad/K8s）自行配置 TCP/HTTP 探针 |
| 启动时 `db:migrate` | 不加 | 当前 `db.server.ts` 已经在首次连接时调用 `migrate()`；schema 演进流程不变 |
| `tini` / `dumb-init` | 不加 | Node 24 的进程模型对 SIGTERM 处理充分；React Router serve 也会响应 |
| `.dockerignore` | **要加** | 至少屏蔽 `node_modules`、`.git`、`packages/apps/i18n-studio/{data,build,.tmp,.react-router,tests/.tmp}`；放在 repo 根（多 stage 共享） |

### A.6 启动命令

- 当前 `CMD ["pnpm", "start"]` → `pnpm start` → `react-router-serve ./build/server/index.js`
- 改为：`CMD ["node", "node_modules/@react-router/serve/dist/cli.js", "./build/server/index.js"]`
- 等价但不再依赖 `pnpm`/`corepack`，启动也更快（少一次 corepack 解析）

## B. 测试体系决策

### B.1 双层目录的语义边界

```
tests/
├── unit/          ← 不打开 sqlite,纯函数 / 校验 / 工具
├── integration/   ← 调用 service 层,依赖真实 sqlite + drizzle
├── helpers.ts     ← bootstrap + seedWorld(给 integration 用)
├── test-db.ts     ← setupTestDb + setupTestDbFromTemplate
├── seed.ts        ← 开发数据 seed,vitest 不会运行
└── .tmp/          ← 运行时临时目录(.gitignore)
    └── _template.db   ← 跑过一次 migrate 后的"母版"
```

边界规则：
- `unit/` 文件**禁止** import `~/lib/db.server`、`drizzle-orm` 任何子模块
- `integration/` 文件**必须**通过 `helpers.bootstrap()` 间接 import service，不直 `import '~/lib/services/...'`（避免与 `vi.resetModules()` 顺序耦合）
- 其它跨 service 校验（HTTP loader/action 链路、UI 行为）**当前不建议在 vitest 里做**——React Router 的 loader/action 依赖请求-响应上下文，目前测试都是 service 层；保持现状

### B.2 Template DB 加速

```
beforeAll (一次):
  fs.rmSync(tests/.tmp/, recursive)
  open _template.db
  migrate()
  close _template.db

beforeEach (每用例):
  dir = mkdtempSync('tests/.tmp/db-')
  copyFileSync(_template.db → dir/test.db)
  process.env.DATABASE_FILE = dir/test.db
  vi.resetModules()    ← 让 db.server 重读 env

afterEach:
  rmSync(dir, recursive)
```

为什么不直接 `:memory:`？
- 现行代码用文件路径，多处会 `new Database(env.DATABASE_FILE)`；切到 `:memory:` 需要把多个连接共享 db 的能力打通（`?cache=shared` 在 better-sqlite3 行为不同），改动大
- Template + copy 是最小破坏改造

为什么不固定 fixtures.sql？
- 现有 `seedWorld()` 已经把 4 个用户 + 2 个 namespace 的 seed 用代码写得很清楚，直接转 SQL 维护一份会引入"两套真值"
- 真有用例需要大批量 fixtures 时，可以在 template db 阶段塞进去（设计预留：`buildTemplate()` 可分阶段写入 base seed），本次不实现

### B.3 测试合并的粒度

合并原则：**按业务域聚合，每个文件 1 个顶层 `describe`，下分多个 `describe`/`it` 子块**。

```
tests/integration/namespace.test.ts
  describe('namespace', () => {
    describe('crud + isolation', ...)         ← 原 isolation.test.ts
    describe('cross-service interaction', ...) ← 原 integration.test.ts
    describe('bundle_version concurrency', ...) ← 原 bundle-version.test.ts
  })

tests/integration/entry-lifecycle.test.ts
  describe('entry lifecycle', () => {
    describe('import', ...)
    describe('publish/discard', ...)
    describe('query views', ...)
  })

tests/integration/translation-flow.test.ts
  describe('translation flow', () => {
    describe('task lifecycle', ...)
    describe('cross-namespace sync', ...)
  })

tests/integration/export-snapshot.test.ts
  describe('export & snapshot', () => {
    describe('exportFlat', ...)
    describe('snapshot channel', ...)
  })

tests/integration/permissions.test.ts   ← 原样保留(矩阵性质,合并会乱)
tests/integration/e2e.test.ts           ← 原 e2e-smoke.test.ts
```

### B.4 vitest.config 关键变化

```ts
test: {
  environment: 'node',
  include: ['tests/**/*.test.{ts,tsx}'],   // ← 删 'app/**'
  setupFiles: ['./tests/setup.ts'],
  // 新增:全局 hook 构建 template
  globalSetup: './tests/global-setup.ts',
}
```

`global-setup.ts` 负责"build template db once"，`setup.ts` 仍负责设置 ENV。

## C. UI 决策

### C.1 D4 的边界——什么改、什么不改

改：
- 把"原生 alert/confirm"全部替换为 Dialog + Sonner
- 引入图标（lucide-react 已经有）
- 列表/表单密度按 shadcn 默认（不刻意压缩或拉宽）

不改：
- shadcn 默认色板（`oklch(...)` 全部保留）
- Tailwind 配置 / `app.css`（除新增 cmd+k 与 dark cookie 相关样式）
- 字体（保留 Inter 声明，**不**新增 self-host 字体文件以避免引入静态资源管道）

### C.2 Cmd+K 命令面板

```
触发:全局键盘监听 ⌘K / Ctrl+K → 打开 <CommandDialog>
渲染位置:挂在 root.tsx 的 Layout(Outlet 之外),这样所有页面都能用

数据源(全部静态/已有 loader 数据):
  1. 命名空间列表    ← root loader 加返回 user 的 namespaces
  2. 当前 ns 内页面  ← 静态(Overview/Entries/Tasks/Sync/...)
  3. 词条 prefix 搜索 ← useFetcher 调用现有 GET /api/namespaces/:slug/entries?prefix=...
                       ↑ 仅在用户输入 ≥ 2 字符时触发,250ms 防抖
  4. 操作快捷
       - "Publish all selected drafts"(仅在 entries 页有选中时显示)
       - "Create translation task"
       - "Toggle theme"

不做:
  - 全文搜索翻译值(需要 FTS,本次不做)
  - 跨 ns 词条搜索(走 prefix 即可)
  - 历史命令记忆
```

实现要点：
- `Command` 来自 shadcn(底层 cmdk)
- 命令面板状态用 React `useState` + `useEffect` 监听键盘
- 不引入额外状态库（与 i18n-studio "不引入 Jotai" 约定一致，状态走 RR loaders/actions）

### C.3 Dark Mode SSR 处理

```
flow:
  1. 用户点 ThemeToggle → submit 到 /api/theme(action only)
       body: { theme: 'light' | 'dark' | 'system' }
       set-cookie: theme=...; Path=/; Max-Age=31536000; SameSite=Lax
  2. 后续请求 root loader 读 cookie:
       const theme = parseTheme(cookieHeader)
  3. Layout 组件 <html className={resolved}> 在 server 渲染时写入
  4. 选 'system' 时 server 不知道客户端偏好,渲染 'light' 作为兜底
       客户端 Layout useEffect 监听 prefers-color-scheme,首次 hydrate 后改 className
       (短暂 FOUC 仅限 'system';'light'/'dark' 完全无 FOUC)

cookie 名: theme
合法值: light | dark | system
默认值: system
```

不引入第三方包（`next-themes` 是 Next 专属，`remix-themes` 旧）；自己实现 `app/lib/theme.server.ts`（30 行内）。

### C.4 页面标题规范

格式：`"<Page> · <Namespace?> · i18n-studio"`（中点 ` · `，不是 ` - `；末尾固定 `i18n-studio`）

每个路由文件**必须**导出 `meta`：

```tsx
export function meta({ data }: Route.MetaArgs) {
  return [{ title: 'Entries · ' + data.namespace.name + ' · i18n-studio' }];
}
```

| 路由 | title |
| ---- | ----- |
| `_index` | `Namespaces · i18n-studio` |
| `login` | `Login · i18n-studio` |
| `register` | `Register · i18n-studio` |
| `ns.new` | `New namespace · i18n-studio` |
| `ns.$slug._index` | `Overview · {ns.name} · i18n-studio` |
| `ns.$slug.entries._index` | `Entries · {ns.name} · i18n-studio` |
| `ns.$slug.entries.$key._index` | `{key} · {ns.name} · i18n-studio` |
| `ns.$slug.entries.$key.history` | `History · {key} · {ns.name} · i18n-studio` |
| `ns.$slug.tasks` | `Tasks · {ns.name} · i18n-studio` |
| `ns.$slug.sync` | `Sync · {ns.name} · i18n-studio` |
| `ns.$slug.members` | `Members · {ns.name} · i18n-studio` |
| `ns.$slug.settings` | `Settings · {ns.name} · i18n-studio` |
| `snapshot.$slug._index` | (resource route, JSON only — 不需要 title) |
| `snapshot.$slug.$locale` | (resource route, JSON only — 不需要 title) |
| `ErrorBoundary 404` | `404 · i18n-studio` |
| `ErrorBoundary 其他` | `Error · i18n-studio` |

API 路由（`api.*`、`logout`）**不要求** title（不用于浏览器渲染）。

## D. 兼容性 / 风险

| 风险 | 缓解 |
| ---- | ---- |
| Dockerfile 改造导致镜像启动失败 | 增加 GitHub Action 在 PR 阶段 `docker build` 验证；本地 `docker run --rm -p 3000:3000 ...` 烟测 |
| Template DB 与 setup.ts 旧逻辑冲突 | 一次性把 setup.ts 与 helpers.ts 改完、12 文件统一搬入 unit/ integration/，不留过渡期 |
| Dark mode FOUC | server 把 cookie 解析到 `<html className>`；选 'system' 时仅极短闪烁，可接受 |
| Cmd+K 全局键盘冲突 | 仅监听 `⌘K`/`Ctrl+K`,在表单 input 内不拦截其他键 |
| meta 标题在数据缺失时崩 | `meta` 函数对 `data` 做空值兜底（Route.MetaArgs 类型已含 `data?: ...`） |
| `pnpm deploy` 在 monorepo workspace 行为差异 | 在 build stage 验证：`pnpm -F i18n-studio deploy --prod /prod && ls /prod/node_modules` |

## E. 不在本次范围

- 词条/成员/权限矩阵任何行为变更
- 增加新的页面或新的 API 资源
- 国际化整个 admin UI（保留中英混排现状）
- 引入图表 / 数据可视化库（Tremor 等）
- 引入 e2e 浏览器测试（Playwright）—— 现有 in-process e2e 已覆盖核心
- 多副本部署 / 数据库连接池 —— SQLite 单文件单进程，本次不变
