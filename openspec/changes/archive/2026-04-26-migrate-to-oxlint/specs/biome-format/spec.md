## REMOVED Requirements

### Requirement: biome-format

**Reason**: oxlint 替代 biome lint 功能，性能更优

**Migration**: 使用 oxlint lint 命令替代 biome lint 命令

### Requirement: prettier 文件移除

**Reason**: 已完成迁移，不再需要此要求

**Migration**: 无需迁移，已在前次变更中完成

## ADDED Requirements

### Requirement: biome 依赖移除

项目 SHALL 在完成 oxlint 迁移后移除 biome 依赖。

#### Scenario: biome 依赖移除
- **WHEN** oxlint 迁移完成且验证通过
- **THEN** @biomejs/biome SHALL 从 package.json devDependencies 移除

#### Scenario: biome.json 移除
- **WHEN** oxlint 迁移完成且验证通过
- **THEN** biome.json SHALL 从项目根目录移除

## MODIFIED Requirements

### Requirement: biome 配置

**原要求：** biome.json SHALL 配置适用于项目的格式化和 lint 规则。

**新要求：** oxlint.json SHALL 配置适用于项目的 lint 规则。

#### Scenario: oxlint 配置存在
- **GIVEN** 项目根目录存在 oxlint.json
- **THEN** 配置 SHALL 包含适当的 lint 规则

#### Scenario: linter rules 配置
- **GIVEN** oxlint.json 配置
- **THEN** 规则 SHALL 与原 biome.json 规则保持一致（尽可能）

#### Scenario: files ignores 配置
- **GIVEN** oxlint.json 配置
- **THEN** 配置 SHALL 包含对 packages 目录的扫描规则

#### Scenario: UI 组件忽略
- **GIVEN** oxlint.json 配置
- **THEN** 配置 SHALL 忽略 `packages/apps/react-app/app/components/ui/**` 目录