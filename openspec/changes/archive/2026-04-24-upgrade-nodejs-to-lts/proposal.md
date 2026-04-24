## Why

当前项目的构建和部署环境使用 Node.js v20.x，需要升级到 LTS 版本（v24.x Krypton）以：
- 利用 LTS 版本的长期支持和安全更新
- 确保与最新依赖包的兼容性
- 为生产环境提供更稳定的运行时保障
- 使用最新的 Node.js 性能优化和特性

## What Changes

- 更新 `.github/workflows/ci.yml` 中的 `node-version` 从 `20` 到 `24`
- 更新 `.devcontainer/devcontainer.json` 中的名称从 `"Node.js 20.x"` 到 `"Node.js 24.x"`
- 更新 `.devcontainer/Dockerfile` 基础镜像从 `1-20-bookworm` 到 `24`
- 更新 `packages/apps/artusx-api/Dockerfile` 基础镜像从 `node:20` 到 `node:24`
- 更新 `packages/apps/react-app/Dockerfile` 基础镜像从 `node:20-alpine` 到 `node:24-alpine`

## Capabilities

### New Capabilities
<!-- 无新增能力，仅更新基础设施配置 -->

### Modified Capabilities
<!-- 无 spec 级别的需求变化 -->

## Impact

- **CI/CD**: GitHub Actions 构建将使用 Node.js v24
- **开发容器**: Devcontainer 将使用 Node.js v24 环境
- **Docker 镜像**: artusx-api 和 react-app 的 Docker 镜像将基于 Node.js v24
- **构建流程**: 依赖安装和构建过程将使用 Node.js v24

## Rollback Plan

如果升级后出现问题，可以：
1. 恢复 CI/CD 配置中的 `node-version: 20`
2. 恢复各 Dockerfile 中的 Node.js v20 基础镜像版本