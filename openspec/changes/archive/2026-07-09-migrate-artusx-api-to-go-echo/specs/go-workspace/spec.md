## ADDED Requirements

### Requirement: Go 工程目录与 pnpm 世界隔离

系统 SHALL 在 monorepo 根目录下新增独立的 `go/` 目录承载所有 Go 代码，且该目录 MUST NOT 被 pnpm workspace（`pnpm-workspace.yaml` 的 `packages/apps/*`、`packages/libs/*`）扫描到，以保证两套工具链互不干扰。

#### Scenario: pnpm 命令不触及 Go 代码
- **WHEN** 在仓库根目录执行 `pnpm install` 或 `pnpm -r build`
- **THEN** `go/` 目录下的任何文件都不被 pnpm 识别为 workspace 包，不参与安装与构建

#### Scenario: Go 代码集中在 go 目录
- **WHEN** 新增任意 Go 源文件、模块或应用
- **THEN** 它们 MUST 位于 `go/` 目录及其子目录内，MUST NOT 出现在 `packages/` 下

### Requirement: 单一 Go module 结构

系统 SHALL 采用单一 `go.mod`（位于 `go/go.mod`）管理所有 Go 代码，module path MUST 为 `implements.io/projectv`。布局遵循 Go 社区惯例：应用入口置于 `go/cmd/<app>/`（薄 `main.go` + 部署产物），私有业务代码置于 `go/internal/`（本 module 私有，含单服务业务与跨服务共享包），MUST NOT 引入 `apps/` 或 `service/` 包裹层。

#### Scenario: 单 module 内部包直接引用
- **WHEN** `go/cmd/<app>` 入口需要引用 `go/internal/` 下的业务或共享包
- **THEN** 可通过 module path（如 `implements.io/projectv/internal/xxx`）直接 `import`，无需额外的 `go.work` 配置

#### Scenario: 构建整个 Go 工程
- **WHEN** 在 `go/` 目录执行 `go build ./...`
- **THEN** 所有 `go/cmd/*` 与 `go/internal/*` 下的包均可成功编译，且不产生二进制落地冲突

#### Scenario: 单个服务独立构建部署
- **WHEN** 执行 `go build ./cmd/<app>`
- **THEN** 仅编译该入口及其实际依赖，在 `go/` 下产出独立二进制（`go/<app>`），不与任何目录同名冲突，不牵连其他应用

### Requirement: Go 代码质量与格式约定

系统 SHALL 为 Go 代码建立格式化与静态检查约定：格式化使用 `gofmt`（或 `gofumpt`），静态检查使用 `golangci-lint`，并在提交前（husky pre-commit）对变更的 `*.go` 文件执行检查。

#### Scenario: 提交前校验 Go 文件
- **WHEN** 提交包含 `*.go` 变更的 commit
- **THEN** pre-commit 钩子 SHALL 对这些文件运行格式化与 lint 检查，未通过则阻止提交

#### Scenario: 格式化不影响非 Go 文件流程
- **WHEN** 提交仅包含 TS/JS 变更
- **THEN** Go 的格式化/lint 检查 MUST NOT 被触发，沿用既有 oxlint/oxfmt 流程

### Requirement: Go 独立 CI

系统 SHALL 新增独立的 Go CI 工作流，对 Go 代码执行构建与测试，且与既有 Node CI（`pnpm -r build`）解耦、互不阻塞。

#### Scenario: Go CI 构建与测试
- **WHEN** 向 `main` 推送或发起 PR 且涉及 `go/` 变更
- **THEN** Go CI SHALL 使用 `actions/setup-go` 执行 `go build ./...` 与 `go test ./...`，任一失败则 CI 失败

#### Scenario: 既有 Node CI 不变
- **WHEN** Go CI 新增后
- **THEN** 既有 `ci.yml`（Node）与 `docker-artusx-api.yml`（Node 版镜像）MUST 保持原有行为不变

### Requirement: Go 应用的容器化产物

系统 SHALL 为 Go 应用提供多阶段构建的 Dockerfile，产出静态单二进制并基于 `distroless` 或 `scratch` 基础镜像，以获得最小镜像体积。

#### Scenario: 构建 Go 版镜像
- **WHEN** 使用 Go 版 Dockerfile 构建镜像
- **THEN** 最终镜像 SHALL 仅包含运行所需的静态二进制与必要的模板/静态资源，MUST NOT 包含 Go 工具链或源码
