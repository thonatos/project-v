# i18n-studio-operational-readiness Specification

## Purpose
TBD - created by archiving change modernize-i18n-studio-platform. Update Purpose after archive.
## Requirements
### Requirement: 生产安全配置门禁

i18n-studio SHALL 在生产环境拒绝使用默认 session secret。生产启动时若 `SESSION_SECRET` 缺失或等于开发默认值，应用 MUST fail fast。

#### Scenario: 生产环境缺少 SESSION_SECRET

- **GIVEN** `NODE_ENV=production` 且未设置 `SESSION_SECRET`
- **WHEN** 应用初始化 auth/session 配置
- **THEN** 系统抛出启动错误，MUST NOT 使用默认 secret 启动服务

#### Scenario: 开发环境允许默认 secret

- **GIVEN** `NODE_ENV=development` 且未设置 `SESSION_SECRET`
- **WHEN** 开发服务启动
- **THEN** 系统允许使用开发默认 secret，并保留本地开发便利性

### Requirement: i18n-studio 专属 CI 门禁

仓库 CI SHALL 为 i18n-studio 执行独立质量门禁，至少包含 typecheck、test 和 Docker build。OpenAPI coverage 与文档契约脚本（`check:openapi-coverage`、`check:doc-contracts`）已移除，不再作为门禁要求。

#### Scenario: PR 执行 i18n-studio checks

- **GIVEN** pull request 修改了 i18n-studio 或共享 workspace 配置
- **WHEN** CI 运行
- **THEN** CI 执行 `pnpm -F i18n-studio typecheck` 和 `pnpm -F i18n-studio test`
- **AND** 不再要求执行 `check:openapi-coverage` 或 `check:doc-contracts`

#### Scenario: Docker build 验证

- **GIVEN** i18n-studio Dockerfile 或运行时依赖发生变更
- **WHEN** CI 运行发布前验证
- **THEN** CI 至少执行一次 i18n-studio Docker build，确保镜像可构建

### Requirement: 文档契约一致性

i18n-studio 文档 SHALL 与实际 OpenSpec 和代码行为一致。文档不得声明未实现的 token 过期时间、一次性 task token 展示规则或 `/healthz` 健康检查路由。

#### Scenario: token 文档匹配 schema

- **GIVEN** token schema 仅包含创建、scope、prefix、hash 和 revokedAt
- **WHEN** 用户阅读 API 文档
- **THEN** 文档不得声明 token 支持 expiresAt，除非 schema 与实现已提供该能力

#### Scenario: 部署文档不声明 healthz

- **GIVEN** OpenSpec 要求应用不暴露 `/healthz`
- **WHEN** 用户阅读部署文档
- **THEN** 文档不得建议使用 `GET /healthz` 作为健康检查

#### Scenario: 迁移策略文档明确

- **GIVEN** 应用采用显式迁移或启动自动迁移中的一种策略
- **WHEN** 用户阅读部署文档
- **THEN** 文档必须与实际行为一致，并说明生产部署的推荐执行方式

### Requirement: 单一文档源

i18n-studio SHALL 以 `app/docs/`（运行时 `/docs` 站点的源）作为唯一的深度文档源。`README.md` MUST 仅承担开源门面职责（定位、特性概览、quickstart、文档入口链接、license），不得重复 `app/docs/` 已覆盖的深度内容，也不得引用 package.json 中不存在的脚本。

#### Scenario: README 不重复深度文档

- **GIVEN** `app/docs/` 已覆盖能力清单、工作流、API、语言库、部署、环境变量等深度内容
- **WHEN** 维护者更新 README
- **THEN** README 仅保留门面内容并链接到文档，MUST NOT 复制深度章节

#### Scenario: README 不引用幽灵脚本

- **GIVEN** 某脚本未在 package.json 的 scripts 中定义
- **WHEN** 维护者撰写 README 或文档命令示例
- **THEN** 文档 MUST NOT 出现该脚本调用（例如已不存在的 `repair:locales`）

### Requirement: 统一脚本运行策略

i18n-studio 的可执行脚本 SHALL 统一使用 TypeScript（`.ts`）并通过 `tsx` 运行。`scripts/` 目录 MUST NOT 保留 `.mjs` 实现或手写 `.d.mts` 声明文件；类型由 `.ts` 源直接提供。

#### Scenario: 脚本目录无混合扩展名

- **GIVEN** 维护者新增或修改 `scripts/` 下的脚本
- **WHEN** 提交变更
- **THEN** 脚本以 `.ts` 形式存在，由 `tsx` 执行，目录中 MUST NOT 出现 `.mjs` 或 `.d.mts`

#### Scenario: package.json 脚本调用 tsx

- **GIVEN** package.json 中需要执行 `scripts/` 下的脚本
- **WHEN** 定义对应的 npm script
- **THEN** 命令使用 `tsx scripts/<name>.ts`，MUST NOT 使用 `node scripts/<name>.mjs`

