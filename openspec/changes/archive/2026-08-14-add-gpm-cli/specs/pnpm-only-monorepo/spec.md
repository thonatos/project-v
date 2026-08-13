## MODIFIED Requirements

### Requirement: pnpm-workspace.yaml 配置

项目 SHALL 在根目录包含 pnpm-workspace.yaml 文件，定义 workspace 包路径。

#### Scenario: workspace 配置正确
- **GIVEN** 项目使用 pnpm 管理 monorepo
- **WHEN** 检查项目根目录的 pnpm-workspace.yaml
- **THEN** 文件 SHALL 包含正确的 packages 路径配置

#### Scenario: workspace 包含所有项目
- **GIVEN** packages 下包含应用、库和工具项目
- **WHEN** pnpm 解析 workspace 配置
- **THEN** 所有 `packages/apps/*`、`packages/libs/*` 和 `packages/tools/*` SHALL 被包含在 workspace 中
