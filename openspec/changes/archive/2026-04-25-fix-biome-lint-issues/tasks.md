## 1. 自动修复

- [x] 1.1 运行 `pnpm lint:fix` 自动修复可修复的问题（已应用 62 文件）
- [x] 1.2 检查自动修复结果，确认无运行时错误（已确认剩余 6 errors, 26 warnings）

## 2. 手动修复 - artusx-api

- [x] 2.1 修复 `noExplicitAny` 问题（替换 `any` 为 `unknown` 或具体类型）- 自动修复后无此问题
- [x] 2.2 修复 `noBannedTypes` 问题（替换 `Function`/`Object` 类型）- 自动修复后无此问题
- [x] 2.3 修复 `noEmptyPattern` 问题 - 自动修复后无此问题
- [x] 2.4 添加 AppConfig 类型定义 - 创建 src/types/config.ts，修复 config 类型声明问题

## 3. 手动修复 - react-app

- [x] 3.1 修复 `noBannedTypes` 问题 - vite-env.d.ts: `{}` → `Record<string, never>`
- [x] 3.2 修复 `noUnusedFunctionParameters` 问题 - 自动修复处理
- [x] 3.3 修复 `noNonNullAssertion` 问题 - 自动修复处理
- [x] 3.4 修复 `useButtonType` 问题 - editor-menu.tsx: 添加 `type="button"`
- [x] 3.5 修复 `noExplicitAny` 问题 - sw.ts, tailwind.config.ts, worker.ts

## 4. 手动修复 - react-component

- [x] 4.1 修复 `noNonNullAssertion` 问题 - 自动修复处理
- [x] 4.2 修复 `useButtonType` 问题 - App.tsx: 添加 `type="button"`

## 5. 手动修复 - remix-api

- [x] 5.1 修复 `noExplicitAny` 问题 - index.tsx, supabase.ts, charge.ts, passkey.ts
- [x] 5.2 修复 `noBannedTypes` 问题 - blog.ts: `{}` → `Record<string, unknown>`
- [x] 5.3 修复 `useHtmlLang` 问题 - home.tsx: 添加 `lang="en"`
- [x] 5.4 修复 `noImplicitAnyLet` 问题 - blog.ts: 添加类型声明

## 6. 手动修复 - remix-flow

- [x] 6.1 修复 `noImplicitAnyLet` 问题 - index.ts: 添加类型声明并重构代码
- [x] 6.2 修复 `useConst` 问题 - 重构代码消除不必要的 let 变量

## 7. 验证

- [x] 7.1 运行 `pnpm biome lint packages` 验证所有 errors 已修复 ✓ (127 files, No fixes applied)
- [x] 7.2 运行 `pnpm -r build` 构建所有项目 ✓ (全部成功)
- [x] 7.3 修复 artusx-api TypeScript 类型错误 - 添加 AppConfig 类型定义解决 config 类型问题