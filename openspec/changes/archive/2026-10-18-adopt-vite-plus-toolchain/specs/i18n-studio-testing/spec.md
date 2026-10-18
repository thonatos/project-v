# Spec Delta

## MODIFIED Requirements

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

- **GIVEN** i18n-studio 的 Vite+ 测试项目配置
- **WHEN** 配置被 Vite+ 内置 Vitest 解析
- **THEN** `test.include` 为 `['tests/**/*.test.{ts,tsx}']`，不包含 `app/**`

### Requirement: Template DB 加速集成测试

集成测试 SHALL 使用一份预迁移好的 `tests/.tmp/_template.db` 作为模板，每个测试用例 MUST 通过文件复制而非重新执行 `migrate()` 来初始化自己的数据库。

#### Scenario: 全局 setup 构建 template

- **GIVEN** Vite+ 内置 Vitest 的全局启动钩子
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

### Requirement: 开发数据 seed 脚本独立于测试

`tests/seed.ts` SHALL 作为开发期生成示例数据的一次性脚本存在，并 SHALL NOT 被 Vite+ 内置 Vitest 收集执行。

#### Scenario: seed.ts 不被 vitest 收集

- **GIVEN** i18n-studio 测试项目的 include 规则
- **WHEN** 运行 `pnpm -F i18n-studio test`
- **THEN** Vite+ 内置 Vitest 的报告中不出现来自 `tests/seed.ts` 的 suite 或 test
