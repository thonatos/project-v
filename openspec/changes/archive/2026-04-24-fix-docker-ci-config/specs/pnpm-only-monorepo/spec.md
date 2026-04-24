## MODIFIED Requirements

### Requirement: pnpm-only-monorepo

项目 SHALL 使用纯 pnpm workspace 管理 monorepo，不依赖 Rush 工具。

#### Scenario: 本地安装依赖
- **WHEN** 开发者运行 `pnpm install`
- **THEN** 系统 SHALL 在根目录安装依赖并生成 pnpm-lock.yaml

#### Scenario: 递归构建所有项目
- **WHEN** 开发者运行 `pnpm -r build`
- **THEN** 系统 SHALL 在所有 workspace 项目中执行 build 脚本

#### Scenario: 递归运行脚本
- **WHEN** 开发者运行 `pnpm -r <script>`
- **THEN** 系统 SHALL 在所有 workspace 项目中执行指定脚本

#### Scenario: Docker 构建使用 pnpm
- **WHEN** Docker 构建应用
- **THEN** 构建步骤 SHALL 使用 `pnpm --filter <package> build`

### Requirement: pnpm-workspace.yaml 配置

项目 SHALL 在根目录包含 pnpm-workspace.yaml 文件，定义 workspace 包路径。

#### Scenario: workspace 配置正确
- **WHEN** 项目根目录存在 pnpm-workspace.yaml
- **THEN** 文件 SHALL 包含正确的 packages 路径配置

#### Scenario: workspace 包含所有项目
- **WHEN** pnpm-workspace.yaml 存在
- **THEN** 所有 packages/apps/* 和 packages/libs/* SHALL 被包含在 workspace 中

### Requirement: Rush 相关文件移除

项目 SHALL 移除所有 Rush 相关文件，减小项目复杂度。

#### Scenario: Rush 配置文件已删除
- **WHEN** 迁移完成
- **THEN** rush.json SHALL 不存在于项目根目录

#### Scenario: Rush 锁文件已删除
- **WHEN** 迁移完成
- **THEN** rush-lock.json SHALL 不存在于项目根目录

#### Scenario: Rush 脚本已删除
- **WHEN** 迁移完成
- **THEN** common/scripts/install-run*.js SHALL 不存在

### Requirement: 项目 scripts 更新

项目 package.json 中的 scripts SHALL 使用 pnpm 命令替代 rush 命令。

#### Scenario: build 命令更新
- **WHEN** 查看任意项目的 package.json
- **THEN** scripts.build SHALL 使用 `pnpm -r build` 而非 rush build

#### Scenario: dev 命令保持不变
- **WHEN** 项目有 dev 脚本
- **THEN** scripts.dev SHALL 保持原样（单项目运行，无需递归）

#### Scenario: Dockerfile 不使用已删除脚本
- **WHEN** Dockerfile 执行构建
- **THEN** 步骤 SHALL 不调用 `_phase:build` 等已删除的脚本

### Requirement: packageManager 字段移除

项目 package.json SHALL 不包含 packageManager 字段。

#### Scenario: react-app 无 packageManager
- **WHEN** 查看 react-app/package.json
- **THEN** 文件 SHALL 不包含 packageManager 字段

#### Scenario: 根目录无 packageManager
- **WHEN** 查看 package.json
- **THEN** 文件 SHALL 不包含 packageManager 字段