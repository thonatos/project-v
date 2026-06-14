## Purpose

定义 i18n-studio 的容器化与生产运行时形态:基础镜像、pnpm 版本固定、产物剥离 dev 依赖、非 root 运行用户、不依赖外部健康检查端点、SQLite 数据卷与端口暴露契约。
## Requirements
### Requirement: 容器化基础镜像

i18n-studio 的容器镜像 SHALL 基于 `node:24-bookworm-slim`，并以多阶段构建产出仅包含生产依赖的运行时镜像。

#### Scenario: 升级到 Node 24

- **GIVEN** Dockerfile 中所有 `FROM` 行的基础镜像
- **WHEN** 进行容器构建
- **THEN** 全部使用 `node:24-bookworm-slim`，不出现 `node:20`、`alpine` 或 `latest` 标签

#### Scenario: 构建出 build/server 与 build/client 产物

- **GIVEN** build stage 内对 `pnpm -F i18n-studio build` 的调用
- **WHEN** build 完成
- **THEN** 在 i18n-studio 包目录下产生 `build/server/index.js` 与 `build/client/` 静态资源，未产生 dev-only 副产物

### Requirement: pnpm 版本固定

容器镜像 SHALL 在 build/deps 阶段通过 corepack 固定 pnpm 大版本到 `pnpm@11`，且 MUST NOT 在仓库根 `package.json` 添加 `packageManager` 字段。

#### Scenario: build 阶段固定 pnpm 大版本

- **GIVEN** Dockerfile build/deps 阶段的 corepack 调用
- **WHEN** 镜像构建
- **THEN** 执行 `corepack prepare pnpm@11 --activate`，pnpm CLI 大版本号为 `11`

#### Scenario: 仓库根 package.json 未被改动

- **GIVEN** 仓库根的 `package.json`
- **WHEN** 本次变更落地
- **THEN** 该文件中不包含 `packageManager` 字段

### Requirement: 生产镜像剥离 dev 依赖与 pnpm

runtime 镜像 SHALL 只携带生产运行所需的产物与依赖，MUST NOT 携带 `pnpm`、`corepack`、`devDependencies` 中的包，或 build 期需要的编译工具链（python3 / make / g++）。

#### Scenario: 通过 pnpm deploy 产出生产目录

- **GIVEN** build stage 内的产物准备
- **WHEN** 执行 `pnpm -F i18n-studio deploy --prod /prod`
- **THEN** `/prod/node_modules` 仅包含 `dependencies` 中声明的包，不包含 `vite` / `@react-router/dev` / `drizzle-kit` / `vitest` 等 dev 依赖

#### Scenario: runtime 阶段不安装编译工具链

- **GIVEN** runtime stage 的 `apt-get install`
- **WHEN** 镜像构建
- **THEN** runtime stage 仅安装 `ca-certificates`，不安装 `python3` / `make` / `g++`

#### Scenario: runtime 镜像中不存在 pnpm

- **GIVEN** 构建出的 runtime 镜像
- **WHEN** 执行 `docker run --rm <image> sh -c 'command -v pnpm'`
- **THEN** 退出码非零，pnpm 不在 PATH 中

### Requirement: 启动入口绕过 pnpm

容器 `CMD` SHALL 直接以 `node` 调用 `@react-router/serve` 的入口，而不通过 `pnpm`/`npm` 间接执行。

#### Scenario: CMD 直接调用 node

- **GIVEN** Dockerfile 末尾的 `CMD`
- **WHEN** 解析镜像配置
- **THEN** `CMD` 形如 `["node", "node_modules/@react-router/serve/dist/cli.js", "./build/server/index.js"]`，且不包含 `pnpm` 或 `npm`

### Requirement: 非 root 运行与数据卷

runtime 镜像 SHALL 以内置 `node` 用户运行，并 SHALL 在 `/data` 上声明卷供 SQLite 数据库使用，且该目录与 `/app` 目录归属 `node:node`。

#### Scenario: 切换到 node 用户运行

- **GIVEN** runtime stage
- **WHEN** 镜像启动
- **THEN** 容器内当前用户为 `node`（uid 1000），`whoami` 输出 `node`

#### Scenario: 数据卷与目录归属

- **GIVEN** runtime stage 的目录准备
- **WHEN** 镜像构建
- **THEN** 存在 `mkdir -p /data` 且 `/data` 与 `/app` 归属 `node:node`，并通过 `VOLUME /data` 声明数据卷

### Requirement: 默认环境变量

runtime 镜像 SHALL 设置生产期默认环境变量：`NODE_ENV=production`、`DATABASE_FILE=/data/i18n.db`、`PORT=3000`。

#### Scenario: 默认 ENV

- **GIVEN** 构建出的 runtime 镜像
- **WHEN** 检查镜像 ENV
- **THEN** 同时存在 `NODE_ENV=production`、`DATABASE_FILE=/data/i18n.db`、`PORT=3000`

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

### Requirement: 构建上下文裁剪

仓库 SHALL 通过 `.dockerignore` 排除与构建无关的目录，至少包括 `**/node_modules`、`**/.git`、`packages/apps/i18n-studio/data`、`packages/apps/i18n-studio/build`、`packages/apps/i18n-studio/.tmp`、`packages/apps/i18n-studio/.react-router`、`packages/apps/i18n-studio/tests/.tmp`。

#### Scenario: .dockerignore 至少包含上述条目

- **GIVEN** 仓库根 `.dockerignore`
- **WHEN** 文件被读取
- **THEN** 上述每一项都至少匹配一行规则

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

