## 1. 准备工作

- [x] 1.1 检查 oxlint npm 包最新版本和安装方式
- [x] 1.2 研究 oxlint 配置文件格式（oxlint.json）
- [x] 1.3 分析现有 biome.json 规则，确认 oxlint 兼容性
- [x] 1.4 确认 oxfmt 当前状态（是否可用）

## 2. oxlint 安装与配置

- [x] 2.1 安装 oxlint 作为 devDependency
- [x] 2.2 创建 oxlint.json 配置文件
- [x] 2.3 配置忽略路径（packages/apps/react-app/app/components/ui/**）
- [x] 2.4 配置 lint 规则（映射 biome 规则）

## 3. package.json 更新

- [x] 3.1 更新 lint script 为 oxlint 命令
- [x] 3.2 更新 lint:fix script 为 oxlint --fix 命令
- [x] 3.3 添加 biome scripts 备份注释（用于回滚）
- [x] 3.4 添加 oxlint 相关 scripts（oxlint-lint）

## 4. 验证与修复

- [x] 4.1 运行 oxlint lint packages 检查错误
- [x] 4.2 修复或忽略不兼容的 lint 规则
- [x] 4.3 确保 lint 检查通过（无阻塞性错误）

## 5. CI/CD 更新

- [x] 5.1 检查 CI workflow 中的 lint 步骤
- [x] 5.2 更新 CI 使用 oxlint 命令
- [x] 5.3 验证 CI lint 步骤正常运行

## 6. 格式化处理（视 oxfmt 状态）

- [x] 6.1 如果 oxfmt 可用，安装并配置格式化
- [x] 6.2 如果 oxfmt 不可用，保留 biome format 功能
- [x] 6.3 更新 format script（根据阶段 6.1/6.2 结果）

## 7. 清理与归档

- [x] 7.1 移除 @biomejs/biome 依赖（如已完成格式化迁移）
- [x] 7.2 移除 biome.json 配置文件（如已完成迁移）
- [x] 7.3 更新 CLAUDE.md 文档中的 lint 命令说明
- [x] 7.4 验证最终状态：lint 和 format 功能正常工作