## MODIFIED Requirements

### Requirement: 不引入容器健康检查与启动迁移

容器 SHALL NOT 内置 `HEALTHCHECK` 指令，应用 SHALL NOT 暴露 `/healthz` 路由。镜像启动 SHALL NOT 通过容器 `CMD` 执行额外的迁移命令；若应用仍保留启动期自动迁移，部署文档 MUST 如实说明该行为。若改为显式迁移，部署文档 MUST 提供独立迁移命令。

#### Scenario: Dockerfile 不含 HEALTHCHECK

- **GIVEN** Dockerfile
- **WHEN** 解析其指令集
- **THEN** 不存在任何 `HEALTHCHECK` 行

#### Scenario: 应用未注册 /healthz 路由

- **GIVEN** 运行中的 i18n-studio 实例
- **WHEN** 访问 `GET /healthz`
- **THEN** 返回 404（与未定义路由表现一致）

#### Scenario: 启动只跑 react-router serve

- **GIVEN** 容器入口命令
- **WHEN** 容器启动
- **THEN** 容器 `CMD` 仅执行 `node .../@react-router/serve` 启动 HTTP 服务，不额外调用 `drizzle-kit migrate` 或自定义迁移脚本

#### Scenario: 部署文档与迁移行为一致

- **GIVEN** 应用选择启动自动迁移或显式迁移任一策略
- **WHEN** 用户阅读部署文档
- **THEN** 文档必须与实际行为一致，MUST NOT 同时声明互相冲突的迁移方式

#### Scenario: 部署文档不建议 /healthz

- **GIVEN** 应用未暴露 `/healthz`
- **WHEN** 用户阅读部署文档
- **THEN** 文档 MUST NOT 建议用 `/healthz` 做存活探针

## ADDED Requirements

### Requirement: 生产 session secret 校验

生产环境 SHALL 强制要求显式配置安全的 `SESSION_SECRET`。当 `NODE_ENV=production` 时，缺失或使用开发默认值 MUST 阻止应用启动。

#### Scenario: 生产环境拒绝默认 secret

- **GIVEN** `NODE_ENV=production` 且 `SESSION_SECRET=dev-secret-change-me`
- **WHEN** 应用初始化 session storage
- **THEN** 系统抛出配置错误，服务不得继续启动

#### Scenario: 生产环境接受显式 secret

- **GIVEN** `NODE_ENV=production` 且 `SESSION_SECRET` 为部署方提供的随机值
- **WHEN** 应用初始化 session storage
- **THEN** session storage 正常创建，cookie 继续使用 secure 配置
