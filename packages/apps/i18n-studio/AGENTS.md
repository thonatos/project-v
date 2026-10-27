# i18n-studio Agent Guidelines

本文件适用于 `packages/apps/i18n-studio/**`，在仓库根 `AGENTS.md` 之上补充本地规则。

## 边界

- 拥有：`app/`（路由、组件、服务端模块）、`tools/i18n-codegen.ts`、`scripts/`（pull / push / seed / backfill）、`data/`（运行时 SQLite）、`app/docs/`（应用内文档）。
- 不拥有：根工具链与 CI 配置、其他应用。
- 数据归属：`data/i18n.db`（WAL）是运行时数据，必须在 `.gitignore` 中；迁移由 `drizzle-kit` 生成，不手改已提交的迁移 SQL。

## 本地约束

- React Router v7 全栈；状态走 loaders / actions，**不引入 Jotai** 等外部状态库。
- UI 用 shadcn/ui；本应用允许直接使用 Radix（全仓其他位置的“不直接用 Radix 原语”约束在这里放宽）。
- 通知用 Sonner；表单优先 React Router `Form` / `useFetcher`。
- 数据库用 SQLite + Drizzle ORM（better-sqlite3）；schema 变更先 `db:generate`，再 `db:migrate`。
- 认证会话需要 `SESSION_SECRET`；构建期会校验非空且非默认值。
- `i18n:push` / `i18n:pull` 使用 `.env` 中的 `STUDIO_BASE_URL`、`STUDIO_NAMESPACE`、`STUDIO_WRITE_TOKEN`；不要把这些值写入代码或日志。
- `app/i18n/generated.ts` 是生成物，不手工编辑；格式检查已忽略该文件。

## 验证入口

| 变更类型                             | 命令                                                        | 期望结果                     |
| ------------------------------------ | ----------------------------------------------------------- | ---------------------------- |
| 应用代码（路由 / 组件 / 服务端模块） | `pnpm -F i18n-studio typecheck`、`pnpm -F i18n-studio test` | 退出码 0，相关用例通过       |
| UI 行为或布局                        | `pnpm -F i18n-studio dev` + 目标视口验证                    | 交互与布局符合预期           |
| 日常开发                             | `pnpm -F i18n-studio dev`                                   | 本地可访问                   |
| 构建                                 | `pnpm -F i18n-studio build`                                 | 退出码 0                     |
| 类型                                 | `pnpm -F i18n-studio typecheck`                             | 退出码 0                     |
| 单元 / 集成                          | `pnpm -F i18n-studio test`                                  | 全部通过                     |
| 监听测试                             | `pnpm -F i18n-studio test:watch`                            | 开发期使用                   |
| 数据库变更                           | `pnpm -F i18n-studio db:generate`、`db:migrate`             | 生成并应用迁移               |
| i18n 代码生成                        | `pnpm -F i18n-studio i18n:codegen`                          | 生成 `app/i18n/generated.ts` |
| i18n 词条检查                        | `pnpm -F i18n-studio i18n:extract:ci`                       | CI 模式检查通过              |
| 种子数据                             | `pnpm -F i18n-studio i18n:seed`                             | 写入本地数据库               |
| Release 回填                         | `pnpm -F i18n-studio release:backfill`                      | 生成/修复 release manifest   |

根 `pnpm test` 已包含本应用的 vitest 项目（`packages/apps/i18n-studio/vitest.config.ts`）。

## CI 映射

| 路径          | workflow                  | 必过门                                                      |
| ------------- | ------------------------- | ----------------------------------------------------------- |
| `packages/**` | `nodejs-ci.yml` → `build` | `pnpm check`、`pnpm test`、`pnpm -r --filter '!vela' build` |
| 部署          | 无 CI gate                | 手动 Docker，见 `app/docs/deployment.md`                    |

## 发布与验收

- 版本不构成交付契约（见 `docs/5.2`）；除非引入对外版本标识，判定为 `NONE` 并写理由。
- 部署是手动操作；部署后在目标环境确认登录、词条读写与 Snapshot 通道，不只依赖本地构建。
