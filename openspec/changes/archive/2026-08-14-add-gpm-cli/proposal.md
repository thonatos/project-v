## Why

我们要新增一个名为 `gpm` 的 Git 项目管理命令行工具，通过单一配置将仓库稳定地克隆到 `<root>/<host>/<repository-path>`，形成一致、可预测的本地项目目录，并以原生二进制形式分发。

## What Changes

- 在 `packages/tools/gpm` 新增 TypeScript CLI 工具，并使用 `scriptc` 编译为无需 Node.js 运行时的原生可执行文件。
- 提供 `gpm init`、`gpm clone <repository-url>`、`gpm help` 和 `gpm version` 命令及对应的帮助参数。
- 使用 `~/.gpmrc` JSON 配置；`root` 必须是只含一个绝对路径的字符串数组。
- `gpm init` 根据当前用户主目录生成绝对的默认 root、创建配置文件和 root 目录，且不覆盖已有配置。
- `gpm clone` 支持 HTTP(S)、`git://`、`ssh://` 和 SCP 风格 Git 地址，将仓库克隆到 `<root>/<host>/<repository-path>`。
- 通过系统 `git` 执行 clone，保留认证交互、实时进度、原始错误信息和失败退出状态。
- 将状态与诊断写入 stderr，成功时将仓库绝对路径写入 stdout，便于 shell 脚本消费。
- 将 `packages/tools/*` 纳入 pnpm workspace，并固定 `scriptc` 的精确版本。

## Capabilities

### New Capabilities

- `gpm-cli`: 定义 gpm 的命令接口、配置初始化与校验、仓库地址解析、目标路径生成、clone 执行、输出和退出码行为。

### Modified Capabilities

- `pnpm-only-monorepo`: 扩展 workspace 包路径要求，使 `packages/tools/*` 下的工具包由 pnpm workspace 管理。

## Impact

- 新增 `packages/tools/gpm` workspace 包、TypeScript 源码、测试和原生构建产物配置。
- 修改 `pnpm-workspace.yaml`，并因新增精确版本的 `scriptc` 开发依赖而更新 `pnpm-lock.yaml`。
- 构建环境需要 Node.js、pnpm、`scriptc` 所需的 clang；生成的 gpm 原生二进制运行时只依赖系统可用的 `git`。
- 用户侧新增 `~/.gpmrc` 和配置指定的 root 目录；不会自动覆盖已有配置或已有仓库目录。
- 回滚时删除 `packages/tools/gpm`，移除 `packages/tools/*` workspace 条目及相关锁文件依赖；用户生成的 `~/.gpmrc`、root 和已克隆仓库属于用户数据，不自动删除。
