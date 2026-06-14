## ADDED Requirements

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

仓库 CI SHALL 为 i18n-studio 执行独立质量门禁，至少包含 typecheck、test、OpenAPI coverage 和 Docker build。

#### Scenario: PR 执行 i18n-studio checks

- **GIVEN** pull request 修改了 i18n-studio 或共享 workspace 配置
- **WHEN** CI 运行
- **THEN** CI 执行 `pnpm -F i18n-studio typecheck`、`pnpm -F i18n-studio test` 和 `pnpm -F i18n-studio check:openapi-coverage`

#### Scenario: OpenAPI coverage 缺失导致失败

- **GIVEN** 新增了 `app/routes/api.*` 或 `app/routes/snapshot.*` 路由但未写入 OpenAPI
- **WHEN** CI 执行 OpenAPI coverage 检查
- **THEN** 检查以非零退出码失败，并列出缺失路径

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
