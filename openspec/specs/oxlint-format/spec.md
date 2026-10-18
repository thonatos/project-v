# oxlint-format Specification

## Purpose

定义 Oxlint 的安装、配置、执行命令和 package scripts 集成要求，为项目提供快速、统一且可在持续集成中复用的静态检查流程。

## Requirements

### Requirement: oxlint 安装

项目 SHALL 通过仓库固定版本的 Vite+ 使用其内置 Oxlint，而不再将独立 Oxlint 包作为根级工具依赖进行维护。

#### Scenario: oxlint 安装成功

- **GIVEN** 项目依赖已安装
- **WHEN** 开发者查询 Vite+ 工具链或运行 lint
- **THEN** Oxlint SHALL 由仓库固定版本的 Vite+ 提供

### Requirement: oxlint 配置

项目 SHALL 在 Vite+ 统一配置中定义 Oxlint 规则和忽略路径，并保持迁移前 `oxlint.json` 的规则意图与扫描边界。

#### Scenario: oxlint 配置存在

- **GIVEN** 项目使用 Vite+ 管理 lint
- **WHEN** 加载仓库统一配置
- **THEN** 配置 SHALL 包含适用于项目的 lint 规则和忽略路径

#### Scenario: oxlint ignores 配置

- **GIVEN** 项目加载统一 lint 配置
- **WHEN** 扫描受管文件
- **THEN** 配置 SHALL 忽略 `packages/apps/react-app/app/components/ui/**`、文档应用生成类型目录和构建产物

### Requirement: oxlint 代码检查

项目 SHALL 通过 Vite+ lint 或组合检查命令执行 Oxlint 代码检查和自动修复。

#### Scenario: oxlint 代码检查

- **WHEN** 开发者运行 `vp lint` 或统一的 `vp check`
- **THEN** Vite+ 内置 Oxlint SHALL 检查所有受管源文件并报告 lint 问题

#### Scenario: oxlint 自动修复

- **WHEN** 开发者运行 `vp lint --fix` 或统一修复命令
- **THEN** Vite+ 内置 Oxlint SHALL 自动修复可安全修复的 lint 问题

### Requirement: package.json scripts 更新

根 package scripts SHALL 使用 Vite+ 命令作为代码质量入口，不得直接调用独立的 Oxlint 或 Oxfmt 二进制。

#### Scenario: lint script 更新

- **GIVEN** 根 package scripts
- **WHEN** 开发者调用 lint 脚本
- **THEN** 该脚本 SHALL 执行 Vite+ lint 或组合检查命令

#### Scenario: lint:fix script 更新

- **GIVEN** 根 package scripts
- **WHEN** 开发者调用 lint 自动修复脚本
- **THEN** 该脚本 SHALL 执行 Vite+ 自动修复命令

#### Scenario: format script 更新

- **GIVEN** 根 package scripts
- **WHEN** 开发者调用格式检查或格式写入脚本
- **THEN** 该脚本 SHALL 分别执行 Vite+ 格式检查或写入命令
