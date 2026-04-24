## Context

当前 biome 配置只启用了格式化功能，lint 功能被禁用。这是在 biome-format spec 中被遗漏的配置细节。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        当前配置状态                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  biome.json                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ {                                                               │   │
│  │   "linter": {                                                   │   │
│  │     "enabled": false  ←── 问题：lint 禁用                        │   │
│  │   },                                                            │   │
│  │   "files": {                                                    │   │
│  │     "ignoreUnknown": false  ←── 问题：无 include 配置            │   │
│  │   }                                                             │   │
│  │ }                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  package.json                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ scripts: {                                                      │   │
│  │   "format": "biome format packages",                            │   │
│  │   "format:write": "biome format packages --write"               │   │
│  │   // ←── 缺少 lint 和 lint:fix                                   │   │
│  │ }                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  .husky/pre-commit                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ pnpm format                                                     │   │
│  │ gitleaks protect --staged                                       │   │
│  │ // ←── 缺少 lint 检查                                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- 启用 biome linter，配置 recommended rules
- 配置 `files.include` 确保正确扫描 packages 目录
- 添加 lint scripts 到根 package.json
- 更新 pre-commit hook 包含 lint 检查

**Non-Goals:**
- 不配置自定义 lint rules（使用 recommended 即可）
-不修改 CI workflow（暂不在 CI 中运行 lint）
- 不处理 lint 发现的现有代码问题（后续单独处理）

## Decisions

### 1. Linter Rules 选择

**选择**: 使用 `recommended` rules

**理由**:
- recommended 是 biome 官方推荐的基础规则集
- 覆盖常见问题：unused variables, suspicious code, security issues
- 无需额外配置，开箱即用
- 可后续根据项目需求添加自定义规则

**替代方案**:
- 自定义 rules: 需要更多维护，当前阶段不必要
- 禁用某些 rules: 先用 recommended，发现问题再调整

### 2. Files Include 配置

**选择**: 配置 `includes: ["packages/**/*.ts", "packages/**/*.tsx", "packages/**/*.js"]`

**注意**: biome 使用 `includes`（复数）而非 `include`

**理由**:
- 只扫描 packages 目录，避免检查 node_modules、openspec 等非项目代码
- 明确指定文件类型，避免处理无关文件
- 与当前 format 命令的范围保持一致

### 3. Pre-commit Hook 顺序

**选择**: lint → format → gitleaks

**理由**:
- lint 最先检查代码问题，有问题立即阻止提交
- format 紧随其后修复格式问题
- gitleaks 最后检查敏感信息泄露

```
pre-commit 流程
─────────────────

  git commit
      │
      ▼
┌─────────────┐
│  lint       │  ← 检查代码问题
│  (block if  │
│   errors)   │
└─────────────┘
      │ pass
      ▼
┌─────────────┐
│  format     │  ← 格式化代码
│  (write)    │
└─────────────┘
      │
      ▼
┌─────────────┐
│  gitleaks   │  ← 检查敏感信息
│  (block if  │
│   leaks)    │
└─────────────┘
      │ pass
      ▼
   commit ok
```

## Risks / Trade-offs

**风险**: 启用 lint 后可能发现大量现有代码问题
- **缓解**: 先运行 `lint` 查看问题数量，如果问题过多可暂时在 CI 中忽略，后续逐步修复

**风险**: lint 可能阻止开发者提交
- **缓解**: 开发者可使用 `lint:fix` 自动修复大部分问题，无法修复的可临时使用 `--no-verify` 跳过

**权衡**: 不在 CI 中运行 lint
- **接受**: CI 配置可后续添加，当前先在本地强制
- **代价**: 可能有一些 lint 问题仍被提交