## Why

防止开发者不小心将敏感信息（如 npm Token、Telegram Bot Token、OpenAI API Key 等）提交到代码仓库。Gitleaks 是一个成熟的 Git 密钥检测工具，可在提交前扫描并阻止敏感信息泄露。

## What Changes

- 添加 `.gitleaks.toml` 配置文件，定义检测规则和允许的白名单
- 添加 `.github/workflows/gitleaks.yml`，在 CI 中执行密钥扫描
- 更新 `.husky/pre-commit`，在提交前强制执行 gitleaks 扫描
- 更新 `.gitignore`，排除 gitleaks 报告文件

## Capabilities

### New Capabilities

- `secrets-scanning`: 定义 Gitleaks 密钥扫描配置，包括检测规则、白名单机制、pre-commit hook 集成

### Modified Capabilities

无（这是新增功能，不修改现有 capability）

## Impact

- **开发者体验**: 提交代码时必须通过密钥扫描，检测到敏感信息会阻止提交
- **CI/CD**: GitHub Actions 每次推送时自动执行 gitleaks 扫描
- **安全**: 提升代码仓库安全性，防止敏感信息泄露