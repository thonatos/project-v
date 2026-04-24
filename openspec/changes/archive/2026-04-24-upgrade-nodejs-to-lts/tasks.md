## 1. 更新 CI 配置

- [x] 1.1 修改 `.github/workflows/ci.yml` 中 `node-version: 20` → `node-version: 24`

## 2. 更新 Devcontainer

- [x] 2.1 修改 `.devcontainer/devcontainer.json` 中 `"name": "Node.js 20.x"` → `"name": "Node.js 24.x"`
- [x] 2.2 修改 `.devcontainer/Dockerfile` 基础镜像 `1-20-bookworm` → `24`

## 3. 更新应用 Dockerfile

- [x] 3.1 修改 `packages/apps/artusx-api/Dockerfile` 基础镜像 `node:20` → `node:24`
- [x] 3.2 修改 `packages/apps/react-app/Dockerfile` 基础镜像 `node:20-alpine` → `node:24-alpine`

## 4. 验证构建

- [ ] 4.1 触发 CI workflow 运行并验证构建成功（已触发，等待 https://github.com/thonatos/project-v/actions 结果）
- [ ] 4.2 验证 Docker 镜像构建成功