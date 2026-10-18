# Spec Delta

## Purpose

为仓库提供统一、可复现的 JavaScript/TypeScript 代码质量与测试工具入口，同时保留应用框架、部署系统、代码生成、完整类型检查及其他语言工具链的独立职责。

## ADDED Requirements

### Requirement: Vite+ 工具链可复现

项目 SHALL 在仓库依赖中固定 Vite+，使本地开发与 CI 使用相同的工具实现和版本，而不依赖开发者机器上的全局安装。

#### Scenario: 全新环境安装工具链
- **GIVEN** 环境满足仓库声明的 Node.js 和包管理器要求
- **WHEN** 开发者安装仓库依赖
- **THEN** 项目 SHALL 提供可直接执行的 `vp` 命令
- **AND** 其版本 SHALL 由仓库依赖和锁文件共同确定

### Requirement: 统一质量检查入口

项目 SHALL 通过 Vite+ 提供 lint、format 和组合检查入口，并保持迁移前的源文件范围、忽略路径和规则意图。

#### Scenario: 只读质量检查
- **GIVEN** 仓库依赖已安装
- **WHEN** 开发者运行统一检查命令
- **THEN** 系统 SHALL 检查受管 JavaScript/TypeScript 文件的格式与 lint 问题
- **AND** 检查 SHALL 不修改文件

#### Scenario: 自动修复质量问题
- **GIVEN** 受管文件存在可安全自动修复的问题
- **WHEN** 开发者运行统一修复命令
- **THEN** 系统 SHALL 使用 Vite+ 内置格式化和 lint 工具应用修复

#### Scenario: 忽略生成目录和既有排除项
- **GIVEN** 文件位于配置声明的生成目录或排除路径
- **WHEN** 运行统一质量检查
- **THEN** 系统 SHALL 不检查或改写该文件

### Requirement: 统一测试工具

项目 SHALL 使用 Vite+ 提供的测试 API、类型、配置入口和测试 runner 执行仓库内全部 JavaScript/TypeScript 自动化测试，不得同时依赖独立 Vitest runner 或 `node:test` runner。

#### Scenario: 执行全部受管测试
- **GIVEN** 仓库依赖和测试前置资源已准备就绪
- **WHEN** 开发者运行 `vp test`
- **THEN** 系统 SHALL 使用 Vite+ 内置测试 runner 发现并执行各受管包的测试
- **AND** 测试失败 SHALL 导致命令以非零状态退出

#### Scenario: 测试源码使用统一 API
- **GIVEN** 测试需要 `test`、`describe`、hook 或 mock API
- **WHEN** 测试源码导入这些 API
- **THEN** 源码 SHALL 从 Vite+ 测试入口导入
- **AND** API 类型与执行 runner SHALL 来自同一 Vite+ 版本

#### Scenario: 保留 Node 断言
- **GIVEN** 现有测试使用 `node:assert/strict`
- **WHEN** 测试迁移至 Vite+ runner
- **THEN** 测试 MAY 继续使用 Node 断言而无需改写为另一种断言风格

#### Scenario: 无测试的 workspace
- **GIVEN** 某个 workspace 没有有效测试
- **WHEN** 执行仓库测试
- **THEN** 系统 SHALL 不通过故意失败的占位脚本表示该 workspace 无测试

#### Scenario: Go 测试保持独立
- **GIVEN** 仓库包含 Go 自动化测试
- **WHEN** JavaScript/TypeScript 测试迁移至 Vite+ 内置 Vitest
- **THEN** Go 测试 SHALL 继续通过 `go test` 执行且不纳入 Vitest 测试发现

### Requirement: 完整类型检查保持独立

项目 SHALL 保留现有 TypeScript 编译器及其前置类型生成链作为完整类型检查依据，不得以 Vite+ 的实验性 lint 类型诊断替代它们。

#### Scenario: React Router 应用类型检查
- **GIVEN** 应用依赖 React Router 生成类型
- **WHEN** 执行该应用的完整类型检查
- **THEN** 系统 SHALL 先生成 React Router 类型再运行现有 TypeScript 编译检查

#### Scenario: i18n Studio 类型检查
- **GIVEN** i18n Studio 的类型依赖本地化代码生成和 React Router 类型生成
- **WHEN** 执行其完整类型检查
- **THEN** 系统 SHALL 保留这些生成步骤并在之后运行 TypeScript 编译检查

### Requirement: 专用命令职责不变

Vite+ 工具链迁移 SHALL 不替换应用框架、部署、业务代码生成、发布、密钥扫描、提交消息或 Go 工具链的专用命令。

#### Scenario: 应用生命周期命令
- **GIVEN** workspace 使用 React Router、Wrangler、Drizzle、ScriptC 或自定义脚本执行开发、构建、部署或代码生成
- **WHEN** 完成 Vite+ 工具链迁移
- **THEN** 这些命令的底层实现 SHALL 保持原有专用工具

#### Scenario: Git hooks 保留附加检查
- **GIVEN** Git hooks 已执行 gitleaks、commitlint 或 Go 文件检查
- **WHEN** hooks 改用 Vite+ 执行 JavaScript/TypeScript 质量检查
- **THEN** 既有附加检查 SHALL 继续执行

#### Scenario: DSH 业务依赖保持不变
- **GIVEN** DSH Telegram 的业务依赖版本已由独立 change 确立
- **WHEN** 迁移该包的测试工具
- **THEN** 本变更 SHALL 不修改其业务依赖版本或解析策略
