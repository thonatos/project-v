## MODIFIED Requirements

### Requirement: simplified-workflows

GitHub Actions 工作流 SHALL 简化为使用纯 pnpm 命令。

#### Scenario: CI 安装 pnpm
- **WHEN** GitHub Actions 运行 CI workflow
- **THEN** 步骤 SHALL 先执行 `npm i -g pnpm` 安装 pnpm

#### Scenario: CI 安装依赖
- **WHEN** GitHub Actions 运行 CI workflow
- **THEN** 步骤 SHALL 使用 `pnpm install` 安装依赖

#### Scenario: CI 构建项目
- **WHEN** GitHub Actions 运行 CI workflow
- **THEN** 步骤 SHALL 使用 `pnpm -r build` 构建所有项目

#### Scenario: CI 移除 Rush 步骤
- **WHEN** GitHub Actions 运行 CI workflow
- **THEN** workflow SHALL 不包含 rush-specific 命令或脚本

### Requirement: CI workflow 结构

CI workflow SHALL 保持必要的验证步骤，同时移除 Rush 特定内容。

#### Scenario: workflow 包含 checkout
- **WHEN** CI workflow 执行
- **THEN** 步骤 SHALL 包含 `actions/checkout@v4`

#### Scenario: workflow 包含 node 设置
- **WHEN** CI workflow 执行
- **THEN** 步骤 SHALL 包含 `actions/setup-node@v4` 配置 Node.js 20

#### Scenario: workflow 包含 pnpm 安装
- **WHEN** CI workflow 执行
- **THEN** 步骤 SHALL 在依赖安装前执行 `npm i -g pnpm`

#### Scenario: workflow 包含构建
- **WHEN** CI workflow 执行
- **THEN** 步骤 SHALL 包含 `pnpm -r build` 构建所有项目