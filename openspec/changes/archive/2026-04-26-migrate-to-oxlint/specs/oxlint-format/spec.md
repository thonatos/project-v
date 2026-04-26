## ADDED Requirements

### Requirement: oxlint 安装

项目 SHALL 使用 oxlint 作为 lint 工具。

#### Scenario: oxlint 安装成功
- **WHEN** 开发者运行 `pnpm add -D oxlint`
- **THEN** oxlint SHALL 作为 devDependency 添加到根 package.json

### Requirement: oxlint 配置

项目 SHALL 配置 oxlint.json 以定义 lint 规则。

#### Scenario: oxlint 配置存在
- **GIVEN** 项目根目录存在 oxlint.json
- **THEN** 配置 SHALL 包含适当的 lint 规则和忽略路径

#### Scenario: oxlint ignores 配置
- **GIVEN** oxlint.json 配置
- **THEN** 配置 SHALL 忽略 `packages/apps/react-app/app/components/ui/**` 目录

### Requirement: oxlint 代码检查

项目 SHALL 使用 oxlint 进行代码检查。

#### Scenario: oxlint 代码检查
- **WHEN** 开发者运行 `pnpm lint` 或 `pnpm oxlint lint packages`
- **THEN** oxlint SHALL 检查所有源文件并报告 lint 错误

#### Scenario: oxlint 自动修复
- **WHEN** 开发者运行 `pnpm lint:fix` 或 `pnpm oxlint lint packages --fix`
- **THEN** oxlint SHALL 自动修复可修复的 lint 问题

### Requirement: package.json scripts 更新

package.json scripts SHALL 使用 oxlint 命令。

#### Scenario: lint script 更新
- **GIVEN** package.json scripts
- **THEN** `lint` script SHALL 执行 oxlint lint 命令

#### Scenario: lint:fix script 更新
- **GIVEN** package.json scripts
- **THEN** `lint:fix` script SHALL 执行 oxlint lint --fix 命令