## Why

项目已完成从 Rush 到 pnpm workspace 的迁移（commit 5a59eba），但 CI 和 Docker 配置未同步更新，导致构建失败。CI workflow 中直接调用 `pnpm` 但未先安装，Dockerfile 仍使用 `npm ci` 和已删除的 `_phase:build` 脚本。

## What Changes

- 删除 `react-app/package.json` 中的 `packageManager` 字段
- 更新 `.github/workflows/ci.yml`，添加 `npm i -g pnpm` 安装步骤
- 重写 `artusx-api/Dockerfile`，采用 pnpm workspace-aware 构建模式
- 重写 `react-app/Dockerfile`，采用 pnpm workspace-aware 构建模式
- 更新 `.github/workflows/docker-artusx-api.yml`，context 改为根目录
- 更新 `README.md`，添加 Prerequisites 说明（Node.js >= 20, pnpm）

## Capabilities

### New Capabilities

- `pnpm-workspace-docker-build`: 定义 pnpm workspace 的 Docker 构建规范，包括 context、依赖安装、构建命令

### Modified Capabilities

- `pnpm-only-monorepo`: 扩展 spec 以涵盖 CI 和 Docker 构建场景
- `simplified-workflows`: 更新 CI workflow 的 pnpm 安装步骤

## Impact

- **CI Pipeline**: 所有 workflow 运行将恢复正常
- **Docker 构建**: artusx-api 和 react-app 的容器化部署将正常工作
- **开发者体验**: README 添加明确的 pnpm 安装说明
- **Rollback**: 若修复失败，可回滚到 commit cdd6f63 前的状态