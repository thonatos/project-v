## Context

项目已完成 Rush → pnpm workspace 迁移，但 CI 和 Docker 配置未同步更新。当前状态：

- CI workflow 直接调用 `pnpm` 但未安装
- Dockerfile 使用 `npm ci` 和已删除的 `_phase:build`
- Docker workflow context 只复制单个 app 目录，缺少 workspace 配置

pnpm workspace 的核心约束：构建 MUST 从根目录开始，需要完整的 `pnpm-workspace.yaml` 和 `pnpm-lock.yaml`。

## Goals / Non-Goals

**Goals:**
- CI workflow 正常运行，包含 pnpm 安装步骤
- Docker 构建支持 pnpm workspace 模式
- 开发者文档清晰说明 pnpm 安装要求

**Non-Goals:**
- 不引入 pnpm/action-setup（使用 npm i -g pnpm 保持一致）
- 不修改构建脚本逻辑（只修复调用方式）

## Decisions

### D1: CI 使用 npm i -g pnpm 而非 pnpm/action-setup

**理由**: 与本地开发方式一致，避免引入新的 GitHub Action 依赖。

**备选方案**: pnpm/action-setup@v4（更专业的方案，但增加了特殊依赖）

### D2: Docker 构建使用完整 workspace context

**理由**: pnpm workspace 需要根目录的 `pnpm-workspace.yaml` 和 `pnpm-lock.yaml` 来解析依赖关系。

**构建流程**:
```
┌─────────────────────────────────────────────────────────────────┐
│  1. COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .      │
│  2. RUN pnpm fetch（预取依赖，利用 layer cache）                 │
│  3. COPY . .（复制完整源码）                                     │
│  4. RUN pnpm install --offline                                  │
│  5. RUN pnpm --filter <target-package> build                    │
│  6. 提取目标包输出                                               │
└─────────────────────────────────────────────────────────────────┘
```

**备选方案**: 只复制单个 app 目录 + 手动生成 dedicated lockfile（复杂且不符合 workspace 语义）

### D3: Docker workflow context 改为根目录

**理由**: Dockerfile 需要 workspace 完整配置，workflow 必须提供根目录 context。

**修改**: 
```yaml
# 当前（错误）
context: '{{defaultContext}}:packages/apps/artusx-api'

# 修复
context: '{{defaultContext}}'
dockerfile: packages/apps/artusx-api/Dockerfile
```

## Risks / Trade-offs

### Risk: Docker 镜像体积增大

完整 workspace context 可能导致镜像体积增大。

**Mitigation**: 使用多阶段构建，最终阶段只复制目标包的输出和必要依赖。

### Risk: 构建时间增加

完整 workspace install 可能比单体应用慢。

**Mitigation**: 使用 `pnpm fetch` 预取依赖，利用 Docker layer cache 加速后续构建。

## Migration Plan

1. 更新 ci.yml，添加 pnpm 安装步骤
2. 更新 docker-artusx-api.yml context
3. 重写 artusx-api/Dockerfile
4. 重写 react-app/Dockerfile（如需要）
5. 删除 react-app/package.json 的 packageManager
6. 更新 README.md

**Rollback**: 若修复失败，回滚相关文件到 commit cdd6f63 前的状态。