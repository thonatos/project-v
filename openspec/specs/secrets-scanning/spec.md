## ADDED Requirements

### Requirement: gitleaks-config-file

项目 SHALL 包含 `.gitleaks.toml` 配置文件，定义密钥检测规则。

#### Scenario: 配置文件存在
- **WHEN** 项目根目录
- **THEN** SHALL 存在 `.gitleaks.toml` 文件

#### Scenario: 配置包含 allowlist
- **WHEN** 查看 `.gitleaks.toml`
- **THEN** SHALL 包含 `[allowlist]` 部分，定义允许跳过检测的文件和模式

#### Scenario: 配置包含项目实际使用的密钥检测规则
- **WHEN** 查看 `.gitleaks.toml`
- **THEN** SHALL 包含以下检测规则：
  - npm Token (`npm_` 前缀)
  - Telegram Bot Token (`数字:字母数字混合` 格式)
  - OpenAI API Key (`sk-` 前缀)
  - GitHub Token (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`)

#### Scenario: 不包含项目未使用的规则
- **WHEN** 查看 `.gitleaks.toml`
- **THEN** SHALL 不包含 AWS AK/SK 等项目未使用的密钥检测规则

### Requirement: allowlist-exclusions

Gitleaks 配置 SHALL 排除不应被扫描的文件。

#### Scenario: 排除配置文件本身
- **WHEN** Gitleaks 执行扫描
- **THEN** SHALL 不扫描 `.gitleaks.toml` 文件

#### Scenario: 排除 lock 文件
- **WHEN** Gitleaks 执行扫描
- **THEN** SHALL 不扫描 `pnpm-lock.yaml` 等锁文件

#### Scenario: 排除测试文件中的 mock 数据
- **WHEN** Gitleaks 执行扫描
- **THEN** MAY 排除测试文件中显式标记为 mock 的密钥

### Requirement: pre-commit-hook

项目 SHALL 在 pre-commit hook 中强制执行 gitleaks 扫描。

#### Scenario: husky pre-commit 包含 gitleaks
- **WHEN** 查看 `.husky/pre-commit`
- **THEN** SHALL 包含 `gitleaks protect --staged` 命令

#### Scenario: 检测到密钥时阻止提交
- **WHEN** 开发者执行 git commit
- **AND** gitleaks 检测到敏感信息
- **THEN** 提交 SHALL 被阻止

#### Scenario: 未检测到密钥时允许提交
- **WHEN** 开发者执行 git commit
- **AND** gitleaks 未检测到敏感信息
- **THEN** 提交 SHALL 正常进行

### Requirement: github-actions-workflow

项目 SHALL 在 GitHub Actions 中集成 Gitleaks 扫描。

#### Scenario: workflow 文件存在
- **WHEN** 项目使用 GitHub Actions
- **THEN** SHALL 存在 `.github/workflows/gitleaks.yml` workflow 文件

#### Scenario: workflow 触发条件
- **WHEN** 查看 gitleaks workflow
- **THEN** SHALL 在 `push` 和 `pull_request` 事件时触发

#### Scenario: workflow 使用 gitleaks-action
- **WHEN** 查看 gitleaks workflow
- **THEN** SHALL 使用 `gitleaks/gitleaks-action@v2` 或官方 action

#### Scenario: 检测到密钥时阻止合并
- **WHEN** Gitleaks 在 PR 中检测到密钥
- **THEN** workflow SHALL 失败并阻止 PR 合并

### Requirement: gitignore-update

`.gitignore` SHALL 排除 gitleaks 相关的临时文件。

#### Scenario: 排除报告文件
- **WHEN** 查看 `.gitignore`
- **THEN** SHALL 包含 `.gitleaks-report.json` 或类似报告文件