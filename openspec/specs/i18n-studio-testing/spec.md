## Purpose

定义 i18n-studio 测试组织约定:双层目录(unit / integration)、template db 加速机制、合并粒度、源码目录禁测、vitest 配置范围。

## Requirements

### Requirement: 测试目录结构

i18n-studio 的所有测试 SHALL 集中在 `packages/apps/i18n-studio/tests/` 下，并按目录区分单元测试与集成测试，源码目录 SHALL NOT 出现 `*.test.{ts,tsx}` 或 `*.spec.{ts,tsx}` 文件。

#### Scenario: 双层目录与共享辅助

- **GIVEN** i18n-studio 工作目录
- **WHEN** 列出 `tests/` 内容
- **THEN** 同时存在 `tests/unit/`、`tests/integration/`、`tests/helpers.ts`、`tests/test-db.ts`、`tests/setup.ts`，且所有 `*.test.*` 文件都位于 `tests/unit/` 或 `tests/integration/` 之下

#### Scenario: 源码目录不含测试

- **GIVEN** i18n-studio 工作目录
- **WHEN** 在 `app/` 子树下匹配 `**/*.test.{ts,tsx}` 或 `**/*.spec.{ts,tsx}`
- **THEN** 匹配数为 0

#### Scenario: vitest include 配置

- **GIVEN** `vitest.config.ts`
- **WHEN** 配置被解析
- **THEN** `test.include` 为 `['tests/**/*.test.{ts,tsx}']`，不再包含 `app/**`

### Requirement: 单元测试隔离于数据库

`tests/unit/` 内的测试 SHALL 不依赖 SQLite、Drizzle 或任何应用全局单例（`db.server.ts`），仅覆盖纯函数与无副作用工具。

#### Scenario: 单元测试不打开数据库

- **GIVEN** `tests/unit/**/*.test.ts` 中任意一个文件
- **WHEN** 检查其 import
- **THEN** 不直接或间接 import `~/lib/db.server` 与 `drizzle-orm/better-sqlite3`

#### Scenario: snapshot etag 测试位置

- **GIVEN** 计算 ETag 的纯函数测试
- **WHEN** 列出 unit 目录
- **THEN** 存在 `tests/unit/snapshot-etag.test.ts`，覆盖原 `app/lib/services/snapshot.test.ts` 的全部用例(确定性、bundleVersion 影响、atVersion 影响)

#### Scenario: validators 单元测试位置

- **GIVEN** 校验函数 `localeSchema` / `flatKeySchema` / `parseEntries` 的纯函数测试
- **WHEN** 列出 unit 目录
- **THEN** 存在 `tests/unit/validators.test.ts`，覆盖原 `app/lib/validators.test.ts` 的全部用例,且原文件已从 `app/` 删除

### Requirement: 集成测试通过共享 helpers

`tests/integration/` 内的测试 SHALL 通过 `tests/helpers.ts` 暴露的 `bootstrap()` 间接获取 service 句柄，而 SHALL NOT 直接 `import '~/lib/services/...'`，以避免与 `vi.resetModules()` 顺序耦合。

#### Scenario: 集成测试通过 bootstrap 拿 service

- **GIVEN** `tests/integration/**/*.test.ts` 中任意一个文件
- **WHEN** 检查其 import
- **THEN** 存在 `from './helpers'` 或 `from '../helpers'`，且不直接 import `~/lib/services/*`

### Requirement: Template DB 加速集成测试

集成测试 SHALL 使用一份预迁移好的 `tests/.tmp/_template.db` 作为模板，每个测试用例 MUST 通过文件复制而非重新执行 `migrate()` 来初始化自己的数据库。

#### Scenario: 全局 setup 构建 template

- **GIVEN** vitest 全局启动钩子
- **WHEN** 测试运行开始
- **THEN** 在 `tests/.tmp/` 下产出唯一的 `_template.db`，对其执行 `migrate()` 后关闭连接

#### Scenario: 用例使用文件复制初始化

- **GIVEN** `tests/test-db.ts` 暴露的初始化函数
- **WHEN** 一个集成测试 `beforeEach` 调用初始化
- **THEN** 通过 `fs.copyFileSync(_template.db, <unique>/test.db)` 创建测试库，并设置 `process.env.DATABASE_FILE` 指向新文件，**不**再次执行 `migrate()`

#### Scenario: 用例结束清理临时目录

- **GIVEN** 测试 `afterEach`
- **WHEN** 测试结束
- **THEN** 该用例创建的临时目录被 `fs.rmSync(..., { recursive: true, force: true })` 删除

### Requirement: 测试文件合并粒度

集成测试 SHALL 按业务域合并为以下 6 个文件，每个文件以单一顶层 `describe` 包裹多个子 `describe`：

| 文件 | 来源 |
| ---- | ---- |
| `tests/integration/namespace.test.ts` | `integration.test.ts` + `isolation.test.ts` + `bundle-version.test.ts` |
| `tests/integration/entry-lifecycle.test.ts` | `import.test.ts` + `publish.test.ts` + `query.test.ts` |
| `tests/integration/translation-flow.test.ts` | `task.test.ts` + `sync.test.ts` |
| `tests/integration/export-snapshot.test.ts` | `export.test.ts` + `snapshot-channel.test.ts` |
| `tests/integration/permissions.test.ts` | `permissions.test.ts`（保留独立） |
| `tests/integration/e2e.test.ts` | `e2e-smoke.test.ts` |

#### Scenario: 仅存在 6 个集成测试文件

- **GIVEN** `tests/integration/`
- **WHEN** 列出 `*.test.ts` 文件
- **THEN** 文件数为 6，且文件名集合等于上表列出的集合

#### Scenario: 合并后用例覆盖不丢失

- **GIVEN** 合并前后的所有 `it(...)` 用例标题
- **WHEN** 比较两个集合
- **THEN** 合并后的 `it` 集合是合并前集合的超集（允许新增对边界条件的补强，禁止删减原有断言）

### Requirement: 开发数据 seed 脚本独立于测试

`tests/seed.ts` SHALL 作为开发期生成示例数据的一次性脚本存在，并 SHALL NOT 被 vitest 收集执行。

#### Scenario: seed.ts 不被 vitest 收集

- **GIVEN** 当前 `vitest.config.ts` 的 include 规则
- **WHEN** 运行 `pnpm -F i18n-studio test`
- **THEN** vitest 报告中不出现来自 `tests/seed.ts` 的 suite 或 test
