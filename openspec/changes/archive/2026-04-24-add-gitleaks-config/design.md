## Context

项目当前没有任何密钥扫描机制，开发者可能在提交代码时无意中暴露敏感信息（npm Token、Telegram Bot Token、OpenAI API Key 等）。这些信息一旦进入 Git 历史，即使后续删除，仍可通过历史记录访问。

项目使用 Husky 管理 Git hooks，已有 `pre-commit` hook。

## Goals / Non-Goals

**Goals:**
- 配置 Gitleaks 检测项目实际使用的密钥类型（npm Token、Telegram Bot Token、OpenAI API Key、GitHub Token）
- 提供白名单机制，允许特定文件或模式跳过检测
- 集成到 pre-commit hook，提交前强制扫描
- 集成到 GitHub Actions CI，推送时自动扫描

**Non-Goals:**
- 不检测项目未使用的密钥类型（如 AWS AK/SK）
- 不替换现有的 `.gitignore` 安全检查（仅作为补充）

## Decisions

### D1: 使用 `.gitleaks.toml` 配置文件

**理由**: 这是 Gitleaks 的标准配置方式，支持自定义规则和白名单。

**检测规则（项目实际使用的密钥类型）**:
- npm Token (`npm_` 前缀或 `_authToken`)
- Telegram Bot Token (`数字:字母数字混合` 格式)
- OpenAI API Key (`sk-` 前缀)
- GitHub Token (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`)

**配置结构**:
```toml
title = "Gitleaks Config"

[allowlist]
description = "允许列表"
paths = [
  '''\.gitleaks\.toml''',
  '''pnpm-lock\.yaml''',
]

[[rules]]
id = "npm-token"
description = "npm Token"
regex = '''npm_[A-Za-z0-9]{36}'''
tags = ["npm", "token"]

[[rules]]
id = "telegram-bot-token"
description = "Telegram Bot Token"
regex = '''[0-9]{9,10}:[A-Za-z0-9_-]{35}'''
tags = ["telegram", "bot"]

[[rules]]
id = "openai-api-key"
description = "OpenAI API Key"
regex = '''sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}'''
tags = ["openai", "api"]
```

### D2: GitHub Actions 集成

**理由**: CI 扫描可确保所有提交都经过密钥检测，双重保障。

**Workflow 结构**:
```yaml
name: Gitleaks
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### D3: 强制 pre-commit hook

**理由**: 安全第一，体验可以让步。在提交前拦截敏感信息，比事后处理更有效。

**实现方式**: 更新 `.husky/pre-commit`，添加 gitleaks 扫描步骤。

```bash
# .husky/pre-commit
gitleaks protect --staged
```

## Risks / Trade-offs

### Risk: 误报影响开发效率

某些文件（如 lock 文件、测试 mock 数据）可能包含 token 格式的字符串。

**Mitigation**: 在 `[allowlist]` 中明确排除这些文件，持续调整白名单。

### Risk: pre-commit 扫描耗时

每次提交需要等待 gitleaks 扫描完成。

**Mitigation**: gitleaks 扫描速度较快，通常在秒级完成。

## Migration Plan

1. 添加 `.gitleaks.toml` 配置文件
2. 更新 `.husky/pre-commit`，添加 gitleaks 扫描步骤
3. 添加 `.github/workflows/gitleaks.yml` workflow
4. 更新 `.gitignore`，排除 gitleaks 报告
5. 提交配置，验证 pre-commit 和 CI 扫描

**Rollback**: 删除 `.gitleaks.toml` 文件，移除 `.husky/pre-commit` 中的 gitleaks 步骤，删除 workflow 文件。