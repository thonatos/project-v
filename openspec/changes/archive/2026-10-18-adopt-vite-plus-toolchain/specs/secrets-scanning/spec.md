# Spec Delta

## MODIFIED Requirements

### Requirement: pre-commit-hook

项目 SHALL 在 Vite+ 管理的 pre-commit hook 中强制执行 gitleaks 扫描。

#### Scenario: husky pre-commit 包含 gitleaks

- **WHEN** 查看 `.vite-hooks/pre-commit`
- **THEN** SHALL 包含 `gitleaks protect --staged` 命令

#### Scenario: 检测到密钥时阻止提交

- **WHEN** 开发者执行 git commit
- **AND** gitleaks 检测到敏感信息
- **THEN** 提交 SHALL 被阻止

#### Scenario: 未检测到密钥时允许提交

- **WHEN** 开发者执行 git commit
- **AND** gitleaks 未检测到敏感信息
- **THEN** 提交 SHALL 正常进行
