# Spec Delta

## MODIFIED Requirements

### Requirement: Go 代码质量与格式约定

系统 SHALL 为 Go 代码建立格式化与静态检查约定：格式化使用 `gofmt`（或 `gofumpt`），静态检查使用 `golangci-lint`，并在提交前由 Vite+ pre-commit hook 对变更的 `*.go` 文件执行检查。

#### Scenario: 提交前校验 Go 文件

- **WHEN** 提交包含 `*.go` 变更的 commit
- **THEN** Vite+ pre-commit 钩子 SHALL 对这些文件运行格式化与 lint 检查，未通过则阻止提交

#### Scenario: 格式化不影响非 Go 文件流程

- **WHEN** 提交仅包含 TS/JS 变更
- **THEN** Go 的格式化/lint 检查 MUST NOT 被触发，JavaScript/TypeScript 文件继续使用 Vite+ staged 检查
