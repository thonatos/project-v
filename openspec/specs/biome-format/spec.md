## ADDED Requirements

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
- **WHEN** 开发者运行 `pnpm biome lint .`
- **THEN** biome SHALL 检查所有源文件并报告 lint 错误

### Requirement: prettier 文件移除

项目 SHALL 移除 prettier 相关配置文件。

#### Scenario: prettier 配置已删除
- **WHEN** 迁移完成
- **THEN** .prettierrc.js SHALL 不存在于项目根目录

#### Scenario: prettier ignore 已删除
- **WHEN** 迁移完成
- **THEN** .prettierignore SHALL 不存在于项目根目录

### Requirement: biome 配置

biome.json SHALL 配置适用于项目的格式化规则。

#### Scenario: biome 配置存在
- **WHEN** 项目根目录存在 biome.json
- **THEN** 配置 SHALL 包含适当的格式化选项

#### Scenario: biome 使用默认配置
- **WHEN** 开发者运行 `pnpm biome init`
- **THEN** 生成的 biome.json SHALL 适用于 TypeScript 和 JavaScript 项目
