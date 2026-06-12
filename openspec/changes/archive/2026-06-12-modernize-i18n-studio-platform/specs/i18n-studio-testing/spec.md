## ADDED Requirements

### Requirement: i18n-studio CI 质量门禁

i18n-studio SHALL 在 CI 中拥有独立质量门禁。门禁 MUST 至少执行 typecheck、test、OpenAPI coverage；涉及 Dockerfile 或生产依赖变更时 MUST 执行 Docker build 验证。

#### Scenario: 执行 typecheck 和测试

- **GIVEN** pull request 修改 i18n-studio 代码
- **WHEN** CI 运行
- **THEN** CI 执行 `pnpm -F i18n-studio typecheck` 和 `pnpm -F i18n-studio test`

#### Scenario: OpenAPI coverage 阻塞缺失文档

- **GIVEN** 新增 API 或 snapshot 路由文件
- **WHEN** `pnpm -F i18n-studio check:openapi-coverage` 发现 OpenAPI 缺失路径
- **THEN** 命令以非零退出码失败，并在输出中列出缺失路径

#### Scenario: Docker build 门禁

- **GIVEN** Dockerfile、package.json 或 pnpm lockfile 影响 i18n-studio 镜像
- **WHEN** CI 运行 Docker 验证阶段
- **THEN** i18n-studio Docker image build 必须成功

### Requirement: 文档契约回归测试

i18n-studio SHALL 对关键文档契约添加测试或检查，防止文档再次声明不存在的 `/healthz`、token 过期时间或错误迁移命令。

#### Scenario: 部署文档不含 healthz 建议

- **GIVEN** 部署文档被修改
- **WHEN** 文档契约检查运行
- **THEN** 若文档建议访问 `/healthz`，检查失败

#### Scenario: API 文档不声明未实现 token 过期

- **GIVEN** token schema 未实现 expiresAt
- **WHEN** 文档契约检查运行
- **THEN** 若 API 文档声明 token 可配置过期时间，检查失败
