## Why

`i18n-studio` 上线后已能完成多语言词条管理的核心工作流，但围绕**部署、测试、界面**三块仍存在工程化短板：

1. **Dockerfile 与生产期望脱节**：基于 `node:20-bookworm-slim`、运行时仍依赖 `pnpm` 与 `corepack@latest`，以 `root` 启动，未锁定 pnpm 版本，镜像携带 dev 依赖。难以满足"开箱即生产"的部署预期。
2. **测试体系结构松散**：12 个测试文件按 service 切分但绝大多数都是集成性质（依赖 SQLite + drizzle migrate），且仍有 1 个测试 `app/lib/services/snapshot.test.ts` 留在源码目录；每个用例都重新跑 migrate，启动开销重复且未区分 unit / integration 层级。
3. **UI 偏功能型，现代化不足**：当前 shell 仅有面包屑式 header + 文字侧栏，没有图标、命令面板、深色模式、面包屑组件、Skeleton/EmptyState 等现代后台标配；表单页面仍用浏览器原生 `alert/confirm`，所有路由都没有 `<title>`。

本次变更只对 `packages/apps/i18n-studio` 内部进行结构性优化，不修改既有词条管理 / 成员管理领域行为。

## What Changes

### A. Dockerfile 生产化

- 升级基础镜像到 **`node:24-bookworm-slim`**
- Dockerfile 内 `corepack prepare pnpm@11 --activate`（**不动 root `package.json`**），固定大版本以避免 `pnpm@latest` 漂移
- build 阶段使用 `pnpm deploy --prod /prod` 产出仅含生产依赖的目录
- runtime 镜像不再携带 `pnpm`/`corepack`，`CMD` 直接调用 `node .../@react-router/serve` CLI
- 以 `USER node` 运行，`/data` 与 `/app` 归属 `node` 用户
- 不引入 `/healthz` 路由 / `HEALTHCHECK` / 启动时自动迁移（与 #4 决策一致）

### B. 测试体系整改

- 把 `app/lib/services/snapshot.test.ts` 与 `app/lib/validators.test.ts` 搬到 `tests/unit/`(分别 `snapshot-etag.test.ts` 与 `validators.test.ts`);`app/` 目录禁止再出现 `*.test.*` 文件
- `vitest.config.ts` 的 `include` 收窄为仅 `tests/**/*.test.{ts,tsx}`
- 新增双层目录：`tests/unit/`（无 db 依赖）、`tests/integration/`（需要 sqlite + drizzle）
- 引入 **template db** 机制：全局 setup 跑一次 `migrate()` 产出 `tests/.tmp/_template.db`，每个用例 `fs.copyFile` 而不是重新 `migrate`，预期 5–10× 加速
- 把 12 个测试文件合并为 8 个(2 unit + 6 integration):
  - `tests/unit/snapshot-etag.test.ts`
  - `tests/unit/validators.test.ts`
  - `tests/integration/namespace.test.ts`（合并 integration + isolation + bundle-version）
  - `tests/integration/entry-lifecycle.test.ts`（合并 import + publish + query）
  - `tests/integration/translation-flow.test.ts`（合并 task + sync）
  - `tests/integration/export-snapshot.test.ts`（合并 export + snapshot-channel）
  - `tests/integration/permissions.test.ts`
  - `tests/integration/e2e.test.ts`（保留 e2e-smoke）
- 保留 `tests/seed.ts`（开发数据 seed 脚本，不参与 vitest 运行）

### C. UI 现代化重构

定位为 **D4 保守增量 + E1 shell + 主战场页**，不替换 shadcn 默认色板，但补齐 modern 后台应有的所有要素。

- 扩充 `app/components/ui/`：新增 `table` / `sheet` / `tabs` / `badge` / `avatar` / `skeleton` / `breadcrumb` / `command` / `separator` / `scroll-area` / `tooltip` / `toggle-group` / `dialog`
- **重做 shell（root + ns layout）**：图标化侧栏、shadcn `Breadcrumb` 组件、用户菜单（DropdownMenu）、移动端 `Sheet` 抽屉
- **重做关键页面**：
  - `/` namespace 卡片网格 + Empty state
  - `/ns/:slug` overview 用图标统计卡
  - `/ns/:slug/entries` 列表用 shadcn `Table` + 行内编辑 `Sheet`
  - `/login` `/register` `/ns/new` 加 logo + 排版
- **命令面板（Cmd+K / Ctrl+K）**：
  - 切换 namespace、跳转页面、按 key 前缀搜索词条（复用现有 prefix 查询）、快捷"批量发布选中 draft / 新建 task"
  - 全局快捷键 `⌘K` / `Ctrl+K`
- **Dark mode**：
  - SSR 安全的 ThemeProvider：root loader 读 cookie + 接受 `system` 回退
  - `<html className={theme}>` 在 server 渲染时直接写入，避免 FOUC
  - header 切换器（ToggleGroup）→ POST `/api/theme` 写 cookie 持久化
- **页面标题规范**：所有路由必须导出 `meta()`，统一格式 `"<Page> · <Namespace?> · i18n-studio"`；规则与示例见 `i18n-studio-ui-shell` spec
- 移除路由内的 `alert()` / `confirm()`，统一改为 `Dialog` 确认 + `sonner` toast 反馈

## Capabilities

### New Capabilities

- `i18n-studio-deployment`：i18n-studio 容器化与生产运行时形态（基础镜像、pnpm 版本、产物剥离、运行用户、不依赖外部健康检查）
- `i18n-studio-testing`：i18n-studio 测试组织约定（双层目录、template db 加速、合并粒度、源码目录禁测）
- `i18n-studio-ui-shell`：i18n-studio 前端 shell、命令面板、深色模式与页面标题规范

### Modified Capabilities

无（不改动 `i18n-entry-management` 与 `i18n-namespace-membership` 任何要求）。

## Impact

- **Dockerfile**：基础镜像升级到 Node 24；构建产物剥离了 dev 依赖与 pnpm；以非 root 运行
- **测试**：CI 跑 `pnpm -F i18n-studio test` 总耗时显著下降；测试文件数 12 → 8
- **UI**：新增约 13 个 shadcn 组件；shell 与 entries 页 UI 整体更新；引入 `app/lib/theme.server.ts` 与 `/api/theme` 路由
- **依赖**：可能新增 `cmdk`（shadcn `Command` 底层）、`@radix-ui/react-tooltip`、`@radix-ui/react-tabs`、`@radix-ui/react-scroll-area` 等 Radix primitives；遵循 `CLAUDE.md` 中"i18n-studio 内放宽 Radix 限制"的项目约定
- **不影响**：词条/成员/任务/同步/快照/权限矩阵的对外行为契约；既有数据库 schema 不动
- **回滚计划**：本次为内部结构性变更，可按子模块独立回滚（Dockerfile / tests / UI 任一可单独 revert）
