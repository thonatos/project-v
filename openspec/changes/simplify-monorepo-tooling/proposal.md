## Why

当前项目使用 rush 管理 monorepo，但实际上只利用了 rush 的少部分能力（如批量脚本执行），项目结构本质上是一个标准的 pnpm workspace。rush 增加了不必要的复杂性、额外的学习成本和依赖维护负担。简化工程化体系可以降低维护成本，提升开发体验。

## What Changes

- **移除 rush**：删除 rush.json 和 rush-related 脚本，保留 pnpm workspace 配置
- **代码格式化工具替换**：将 prettier 替换为 biome.js（更快的性能，更小的依赖）
- **GitHub Copilot 配置清理**：移除无效或冗余的 copilot 配置
- **GitHub Actions 工作流更新**：简化 CI/CD 流程，适配新的包管理方式
- **保留私有 npm 仓库配置**：.npmrc 中的私有仓库配置保持不变
- **更新 CLAUDE.md**：反映新的项目结构和命令

**BREAKING**:
- 项目构建命令从 `rush build` 变为 `pnpm -r build`
- 开发者需要先安装 pnpm（如果尚未安装）

## Capabilities

### New Capabilities

- `pnpm-only-monorepo`: 使用纯 pnpm workspace 管理 monorepo，移除对 rush 的依赖
- `biome-format`: 使用 biome.js 替代 prettier 作为代码格式化和 lint 工具
- `simplified-workflows`: 简化的 GitHub Actions 工作流，移除 rush 相关的构建步骤

### Modified Capabilities

<!-- 现有 spec 列表为空，无需修改 -->

## Impact

- **受影响的代码**:
  - `rush.json`, `rush-lock.json` 将被删除
  - `common/` 目录下的 rush 相关脚本将被移除
  - `package.json` 中的 rush 相关 script 将被移除或替换
  - `.prettierrc.js`, `.prettierignore` 将被删除（由 biome 替代）
  - `.github/copilot-*` 配置将被清理

- **新增依赖**:
  - `@biomejs/biome` 作为 devDependency

- **保留配置**:
  - `.npmrc` 私有仓库配置
  - `.git/hooks/` git hooks 配置
  - `commitlint.config.js` commit lint 配置

## Rollback Plan

如需回滚，可以执行以下步骤：

1. 恢复 `rush.json` 和 `rush-lock.json`
2. 从 git 历史恢复 `common/` 目录下的 rush 脚本
3. 恢复 `package.json` 中的 rush 相关依赖和脚本
4. 重新安装 rush: `npm install -g @microsoft/rush`
5. 运行 `rush install` 恢复依赖
6. 恢复 prettier 相关配置

**注意**: 回滚后需要重新构建所有项目以确保一致性。
