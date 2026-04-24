## Context

当前项目的构建和部署环境使用 Node.js v20.x：
- `.github/workflows/ci.yml`: `node-version: 20`
- `.devcontainer/devcontainer.json`: `"name": "Node.js 20.x"`
- `.devcontainer/Dockerfile`: `mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm`
- `packages/apps/artusx-api/Dockerfile`: `FROM node:20 AS base`
- `packages/apps/react-app/Dockerfile`: `FROM node:20-alpine AS base`

需要升级到 Node.js LTS v24.x (Krypton)。项目不锁定开发者的本地 Node.js 版本，仅确保构建和部署环境使用 LTS 版本。

## Goals / Non-Goals

**Goals:**
- 更新所有 CI/CD 和 Docker 配置使用 Node.js LTS v24 (Krypton)
- 确保构建和部署流程稳定运行
- 验证依赖包与 Node.js v24 的兼容性

**Non-Goals:**
- 不创建 `.nvmrc` 文件锁定项目版本
- 不在 `package.json` 中添加 engines 字段
- 不强制开发者使用特定 Node.js 版本
- 不升级依赖包（除非明确不兼容）

## Decisions

### 1. 仅更新构建环境

**选择**: 只更新 CI/CD 和 Dockerfile，不锁定项目版本

**理由**:
- 项目不强制要求开发者使用特定版本
- 仅确保构建和部署环境的一致性
- 减少对开发者本地环境的影响

### 2. Docker 镜像版本选择

**选择**: 使用 `node:24` 和 `node:24-alpine`

**理由**:
- LTS 版本 v24 (Krypton) 提供长期支持
- Alpine 版本体积更小，适合生产部署
- 标准版本适合需要更多系统工具的场景

### 3. Devcontainer 版本

**选择**: 使用 `mcr.microsoft.com/devcontainers/javascript-node:24`

**理由**:
- 与其他 Dockerfile 保持一致的 Node.js v24 版本
- Microsoft 官方镜像，预配置开发环境

## Risks / Trade-offs

**风险**: 依赖包不兼容 Node.js v22
- **缓解**: 升级后运行完整 CI 构建和测试套件

**风险**: Docker 镜像构建时间可能增加
- **缓解**: 使用缓存层保持构建效率

**权衡**: 不锁定本地开发版本
- **接受**: 开发者可使用任意 Node.js 版本进行开发
- **代价**: 本地开发环境与 CI 可能存在版本差异

## Migration Plan

### 步骤 1: 更新 CI 配置
1. 修改 `.github/workflows/ci.yml` 中的 `node-version: 20` → `node-version: 24`

### 步骤 2: 更新 Devcontainer
1. 修改 `.devcontainer/devcontainer.json` 中的 `"name": "Node.js 20.x"` → `"name": "Node.js 24.x"`
2. 修改 `.devcontainer/Dockerfile` 基础镜像 `mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm` → `mcr.microsoft.com/devcontainers/javascript-node:24`

### 步骤 3: 更新应用 Dockerfile
1. 修改 `packages/apps/artusx-api/Dockerfile` 基础镜像 `node:20` → `node:24`
2. 修改 `packages/apps/react-app/Dockerfile` 基础镜像 `node:20-alpine` → `node:24-alpine`

### 步骤 3: 验证构建
1. 触发 CI workflow 运行
2. 检查所有构建步骤是否正常
3. 验证 Docker 镜像构建成功

### 回滚计划
如果出现严重兼容性问题：
1. 恢复所有配置文件中的 Node.js v20 版本号
2. 重新触发 CI 构建

## Open Questions

无待解决问题。