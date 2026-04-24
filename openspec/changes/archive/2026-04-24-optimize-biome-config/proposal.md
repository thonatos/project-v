## Why

当前 biome.json 配置存在问题：
1. `linter.enabled: false` - lint 功能被禁用，无法进行代码质量检查
2. `files.include` 未配置 - 导致 lint 命令无法正确扫描 packages 目录
3. 根 package.json 缺少 lint 相关 scripts - 开发者无法方便地运行 lint 检查

这些问题导致项目只使用 biome 做格式化，而未能发挥其 lint 检查能力，无法在开发阶段发现潜在的代码问题。

## What Changes

- 启用 biome linter，配置 recommended rules
- 添加 `files.include` 配置，指定扫描范围为 packages 目录下的 TS/TSX/JS 文件
- 在根 package.json 添加 `lint` 和 `lint:fix` scripts
- 更新 pre-commit hook，添加 lint 检查步骤

## Capabilities

### New Capabilities
<!-- 无新增能力 -->

### Modified Capabilities
- `biome-format`: 修改现有 spec，增加对 linter 配置和 lint scripts 的具体要求

## Impact

- **开发者体验**: 可以使用 `pnpm lint` 检查代码，`pnpm lint:fix` 自动修复问题
- **pre-commit**: 提交前会自动运行 lint 检查，阻止有问题的代码提交
- **CI**: 无影响（CI 目前未运行 lint）

## Rollback Plan

如果启用 lint 后发现问题：
1. 将 `linter.enabled` 设回 `false`
2. 移除 package.json 中的 lint scripts
3. 从 pre-commit hook 移除 lint 步骤