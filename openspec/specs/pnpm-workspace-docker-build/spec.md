# pnpm-workspace-docker-build Specification

## Purpose
定义 pnpm workspace 项目的 Docker 多阶段构建方式，使依赖安装、应用构建和运行时镜像能够正确处理 monorepo 包关系。

## Requirements

### Requirement: pnpm-workspace-docker-build

Docker 构建 SHALL 使用完整 workspace context，从根目录开始构建。

#### Scenario: Dockerfile 复制 workspace 配置
- **WHEN** Docker 构建开始
- **THEN** 步骤 SHALL 复制 `pnpm-lock.yaml` 和 `pnpm-workspace.yaml` 到容器

#### Scenario: Dockerfile 使用 pnpm 安装依赖
- **WHEN** Docker 构建安装依赖
- **THEN** 步骤 SHALL 使用 `pnpm install` 或 `pnpm fetch` + `pnpm install --offline`

#### Scenario: Dockerfile 使用 filter 构建目标包
- **WHEN** Docker 构建特定应用
- **THEN** 步骤 SHALL 使用 `pnpm --filter <package-name> build` 构建目标包

#### Scenario: Docker workflow 提供根目录 context
- **WHEN** Docker workflow 触发构建
- **THEN** context SHALL 设置为根目录（不是单个 app 子目录）

### Requirement: Docker 多阶段构建

Dockerfile SHALL 使用多阶段构建优化镜像体积。

#### Scenario: 预取依赖阶段
- **WHEN** Docker 构建开始
- **THEN** 第一阶段 SHALL 使用 `pnpm fetch` 预取依赖以利用 layer cache

#### Scenario: 构建阶段
- **WHEN** 依赖已预取
- **THEN** 构建阶段 SHALL 使用 `pnpm install --offline` 和 `pnpm --filter build`

#### Scenario: 发布阶段只包含必要文件
- **WHEN** 构建完成
- **THEN** 最终镜像 SHALL 只包含目标包输出和必要依赖
