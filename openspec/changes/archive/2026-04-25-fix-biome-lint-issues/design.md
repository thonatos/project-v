## Context

启用 biome linter 后，pre-commit hook 阻止提交。需要修复 30 errors 和 81 warnings 才能恢复正常开发流程。

问题分布：
```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Lint Issues Distribution                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  noExplicitAny          44  ████████████████████████████████████        │
│  noBannedTypes          17  ████████████                                │
│  noEmptyPattern         12  ████████                                    │
│  noImplicitAnyLet        6  ████                                        │
│  noUnusedFunctionParams  6  ████                                        │
│  useNodejsImportProto    4  ███                                         │
│  useOptionalChain        4  ███                                         │
│  noNonNullAssertion      3  ██                                          │
│  noUnusedImports         3  ██                                          │
│  noUnusedVariables       2  █                                           │
│  others                  3  █                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- 修复所有 lint errors，使 `pnpm lint` 通过
- 修复大部分 lint warnings，减少到可接受水平
- 保持代码功能不变

**Non-Goals:**
- 不添加新功能或重构代码
- 不修改 API 或接口定义（除非类型修复需要）
- 不处理 warnings 超过 10 个的情况（后续逐步优化）

## Decisions

### 1. 修复策略

**选择**: 先自动修复，再手动修复剩余问题

**理由**:
- 4 个 `useNodejsImportProtocol` 和部分其他问题可自动修复
- 自动修复速度快，减少人工错误
- 手动修复需要仔细检查类型定义

**流程**:
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ lint:fix     │────▶│ 检查剩余     │────▶│ 手动修复     │
│ (自动修复)   │     │ errors       │     │ (逐个处理)   │
└──────────────┘     └──────────────┘     └──────────────┘
```

### 2. `any` 类型处理策略

**选择**: 使用 `unknown` 或具体类型替换 `any`

**理由**:
- `unknown` 是类型安全的 `any`，需要类型检查后使用
- 尽可能定义具体类型，提高代码质量

**替代方案**:
- 禁用 `noExplicitAny` rule: 不推荐，降低代码质量
- 使用 `Record<string, unknown>`: 适用于配置对象

### 3. Banned Types 处理策略

**选择**: 替换 `Function` 为具体函数类型，替换 `Object` 为 `Record<string, unknown>`

**理由**:
- `Function` 类型不安全，无法正确推断参数和返回值
- `Object` 类型过于宽泛，应使用更具体的类型

## Risks / Trade-offs

**风险**: 类型修改可能导致 TypeScript 编译错误
- **缓解**: 修复后运行 `tsc --noEmit` 检查类型正确性

**风险**: 部分修复可能改变运行时行为
- **缓解**: 优先使用 `unknown` 而非 `any`，需要显式类型转换

**权衡**: 不修复所有 warnings
- **接受**: 先修复 errors，warnings 可后续逐步优化
- **代价**: 代码仍有改进空间