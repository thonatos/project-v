## 1. Gitleaks 配置文件

- [x] 1.1 创建 `.gitleaks.toml` 配置文件
  - 配置 `[allowlist]` 白名单
  - 配置 npm Token 检测规则
  - 配置 Telegram Bot Token 检测规则
  - 配置 OpenAI API Key 检测规则
  - 配置 GitHub Token 检测规则

## 2. Pre-commit Hook

- [x] 2.1 更新 `.husky/pre-commit`，添加 gitleaks 扫描步骤

## 3. GitHub Actions Workflow

- [x] 3.1 创建 `.github/workflows/gitleaks.yml`
  - 配置 push 和 pull_request 触发
  - 使用 gitleaks/gitleaks-action@v2

## 4. Gitignore 更新

- [x] 4.1 更新 `.gitignore`，排除 gitleaks 报告文件

## 5. 验证

- [x] 5.1 提交变更，验证 pre-commit hook 正常工作
- [ ] 5.2 观察 GitHub Actions workflow 运行结果