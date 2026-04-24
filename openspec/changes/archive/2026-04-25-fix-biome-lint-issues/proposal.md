## Why

启用 biome linter 后发现 30 errors, 81 warnings。这些问题阻碍 pre-commit hook 正常运行，需要修复才能正常提交代码。

主要问题类型：
- 44 个 `noExplicitAny` - 使用 `any` 类型
- 17 个 `noBannedTypes` - 使用 `Function`、`Object` 等 banned types
- 12 个 `noEmptyPattern` - 空的解构模式
- 6 个 `noImplicitAnyLet` - let 隐式 any
- 6 个 `noUnusedFunctionParameters` - 未使用的函数参数
- 4 个 `useNodejsImportProtocol` - Node.js 模块应使用 `node:` 协议
- 其他零散问题

## What Changes

- 使用 `pnpm lint:fix` 自动修复可修复的问题（FIXABLE 标记）
- 手动修复无法自动修复的问题：
  - `noExplicitAny`: 替换 `any` 为具体类型
  - `noBannedTypes`: 替换 `Function`/`Object` 为具体类型
  - `noEmptyPattern`: 处理空的解构模式
  - `noUnusedFunctionParameters`: 移除或使用未使用参数

## Capabilities

### New Capabilities
<!-- 无新增能力，仅修复代码问题 -->

### Modified Capabilities
<!-- 无 spec 级别需求变化 -->

## Impact

- **artusx-api**: 大部分 `any` 类型问题在此应用
- **react-app**: 部分 banned types 和 unused parameters 问题
- **react-component**: 少量 non-null assertion 问题

## Rollback Plan

如果修复导致类型错误或运行问题：
1. 恢复相关文件的原始类型定义
2. 对特定文件禁用相关 lint rules（在 biome.json 中配置 overrides）