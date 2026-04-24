## 1. CI Workflow 修复

- [x] 1.1 更新 `.github/workflows/ci.yml`，添加 `- run: npm i -g pnpm` 步骤
- [x] 1.2 验证 CI workflow 能正常运行 pnpm install 和 pnpm -r build

## 2. Docker Workflow 修复

- [x] 2.1 更新 `.github/workflows/docker-artusx-api.yml`，context 改为根目录
- [x] 2.2 添加 `dockerfile` 参数指定 Dockerfile 路径

## 3. Dockerfile 重写

- [x] 3.1 重写 `packages/apps/artusx-api/Dockerfile`
  - 使用 pnpm fetch 预取依赖
  - 使用 pnpm --filter artusx-api build
  - 移除 _phase:build 引用
- [x] 3.2 重写 `packages/apps/react-app/Dockerfile`
  - 使用 pnpm workspace 模式
  - 使用 pnpm --filter react-app build

## 4. package.json 清理

- [x] 4.1 删除 `packages/apps/react-app/package.json` 的 packageManager 字段

## 5. 文档更新

- [x] 5.1 更新 `README.md`，添加 Prerequisites 部分
  - Node.js >= 20
  - pnpm (npm install -g pnpm)

## 6. 验证（用户自行检查）

- [ ] 6.1 提交变更，观察 CI workflow 运行结果