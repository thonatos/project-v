## Why

当前项目使用 biome.js 作为代码格式化和 lint 工具。Oxlint 和 oxfmt 是 Oxide 项目推出的新一代 lint 和格式化工具，基于 Rust 编写，性能显著优于 biome（快 50-100 倍）。迁移到 oxlint/oxfmt 可以：

1. 大幅提升 lint 和格式化的执行速度，改善开发者体验
2. 减少 CI/CD 中 lint/format 步骤的执行时间
3. 保持与 ESLint 规则的高度兼容性

## What Changes

- **移除** biome 作为 lint 和 format 工具
- **新增** oxlint 作为 lint 工具（替代 biome lint）
- **新增** oxfmt 作为格式化工具（替代 biome format）
- **更新** package.json scripts（lint、lint:fix、format）
- **更新** CI/CD 配置以使用新工具
- **移除** biome.json 配置文件
- **新增** oxlint.json 配置文件（oxlint 配置）
- **BREAKING** 现有的 biome CLI 命令将不再可用

## Capabilities

### New Capabilities

- `oxlint-format`: 使用 oxlint 和 oxfmt 进行代码 lint 和格式化的能力规范

### Modified Capabilities

- `biome-format`: **要求变更** - 将 biome 相关要求替换为 oxlint/oxfmt 要求。规则和配置方式将发生根本性变化。

## Impact

- **影响代码**: 根 package.json（scripts）、所有 packages 目录下的 TypeScript/JavaScript 文件（可能需要重新格式化）
- **影响配置**: biome.json → oxlint.json、可能的 .oxlintignore
- **影响依赖**: 移除 @biomejs/biome，添加 oxlint
- **影响 CI**: 所有使用 biome 的 CI workflow 需要更新
- **回滚计划**:
  1. 保留 biome.json 配置文件备份
  2. 在 package.json 中保留 biome 相关 scripts（注释状态）
  3. 如需回滚，恢复 biome 依赖和 scripts，删除 oxlint 配置