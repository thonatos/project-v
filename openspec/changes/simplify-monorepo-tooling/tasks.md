## 1. 准备工作

- [x] 1.1 确认所有更改已提交到 git
- [x] 1.2 检查 common/config/rush/.npmrc 内容，确认私有仓库配置

## 2. 创建 pnpm-workspace 配置

- [x] 2.1 创建 pnpm-workspace.yaml（packages: - 'packages/apps/*' - 'packages/libs/*'）
- [x] 2.2 验证 pnpm-workspace.yaml 配置正确

## 3. 安装 biome.js

- [x] 3.1 运行 `pnpm add -D @biomejs/biome`
- [x] 3.2 运行 `pnpm biome init` 生成 biome.json
- [x] 3.3 验证 biome.json 生成成功

## 4. 更新 package.json scripts

- [x] 4.1 检查根目录 package.json 中的 rush 相关 scripts
- [x] 4.2 将 `rush build` 替换为 `pnpm -r build` (不适用 - 无 rush scripts)
- [x] 4.3 将 `rush update` 替换为 `pnpm -r update`（如适用）(不适用)
- [x] 4.4 检查并更新各子项目的 package.json scripts（如有 rush 引用）(不适用)

## 5. 更新 GitHub Actions

- [x] 5.1 修改 .github/workflows/ci.yml
- [x] 5.2 将 `node common/scripts/install-run-rush.js install` 替换为 `pnpm install`
- [x] 5.3 将 `node common/scripts/install-run-rush.js rebuild` 替换为 `pnpm -r build`
- [x] 5.4 移除 change log 验证步骤（如有 rush change 相关）
- [x] 5.5 验证 CI workflow 语法正确

## 6. 清理 Rush 相关文件

- [x] 6.1 删除 rush.json
- [x] 6.2 删除 rush-lock.json（如果存在）(不存在，未删除)
- [x] 6.3 删除 .prettierrc.js
- [x] 6.4 删除 .prettierignore
- [x] 6.5 删除 common/scripts/install-run*.js
- [x] 6.6 删除 common/scripts/install-run.js

## 7. 清理 GitHub Copilot 配置

- [x] 7.1 检查 .github/ 目录下是否存在 copilot 相关文件(无)
- [x] 7.2 如有 copilot-* 文件，删除无效或冗余的配置(无)

## 8. 验证迁移

- [x] 8.1 运行 `pnpm install` 额外依赖安装
- [x] 8.2 运行 `pnpm -r build` 验证所有项目构建成功
- [x] 8.3 运行 `pnpm biome lint .` 验证 biome 工作正常
- [x] 8.4 运行 `pnpm biome format --write .` 格式化代码

## 9. 抽取 commitlint 配置

- [x] 9.1 安装 @commitlint/config-conventional 到根目录
- [x] 9.2 更新 commitlint.config.js 使用标准配置

## 10. 设置 husky git hooks

- [x] 10.1 安装 husky
- [x] 10.2 创建 .husky/commit-msg hook
- [x] 10.3 创建 .husky/pre-commit hook
- [x] 10.4 删除旧的 .git/hooks

## 11. 清理 common 目录

- [x] 11.1 删除整个 common 目录

## 12. 更新文档

- [x] 12.1 更新 CLAUDE.md 中的命令（rush → pnpm -r）
- [x] 12.2 更新 README.md
- [ ] 12.3 提交所有更改

## 13. 回滚计划（如需）

- [ ] 13.1 从 git 历史恢复 rush.json
- [ ] 13.2 从 git 历史恢复 rush-lock.json
- [ ] 13.3 从 git 历史恢复 common/
- [ ] 13.4 从 git 历史恢复 .prettierrc.js 和 .prettierignore
- [ ] 13.5 从 git 历史恢复 .github/workflows/ci.yml
- [ ] 13.6 运行 `rush install` 验证回滚成功