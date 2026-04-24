## MODIFIED Requirements

### Requirement: biome 配置

biome.json SHALL 配置适用于项目的格式化和 lint 规则。

#### Scenario: biome 配置存在
- **GIVEN** 项目根目录存在 biome.json
- **THEN** 配置 SHALL 包含适当的格式化选项和 lint 规则

#### Scenario: linter 启用
- **GIVEN** biome.json 配置
- **THEN** `linter.enabled` SHALL 为 `true`

#### Scenario: linter rules 配置
- **GIVEN** biome.json 配置
- **THEN** `linter.rules.recommended` SHALL 为 `true`

#### Scenario: files include 配置
- **GIVEN** biome.json 配置
- **THEN** `files.include` SHALL 包含 `packages/**/*.ts`、`packages/**/*.tsx`、`packages/**/*.js`

### Requirement: biome-format

项目 SHALL 使用 biome.js 替代 prettier 作为代码格式化和 lint 工具。

#### Scenario: biome 安装成功
- **WHEN** 开发者运行 `pnpm add -D @biomejs/biome`
- **THEN** biome SHALL 作为 devDependency 添加到根 package.json

#### Scenario: biome 初始化
- **WHEN** 开发者运行 `pnpm biome init`
- **THEN** biome.json SHALL 在根目录生成

#### Scenario: 代码格式化
- **WHEN** 开发者运行 `pnpm biome format --write .`
- **THEN** biome SHALL 格式化所有符合条件的源文件

#### Scenario: 代码检查
- **WHEN** 开发者运行 `pnpm lint` 或 `pnpm biome lint packages`
- **THEN** biome SHALL 检查所有源文件并报告 lint 错误

#### Scenario: 代码检查自动修复
- **WHEN** 开发者运行 `pnpm lint:fix` 或 `pnpm biome lint packages --write`
- **THEN** biome SHALL 自动修复可修复的 lint 问题