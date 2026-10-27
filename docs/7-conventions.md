# 7. 编码约定

> 这些是跨包约定。包级例外写在该包 `AGENTS.md`，并以包内配置为准。

## 7.1 TypeScript / Node

- 数据结构用 `interface` 定义。
- 避免 `any`；不确定时用 `unknown` 或具体类型。
- 用 `const` 与 `readonly` 保持不可变。
- Node 内置模块使用 `node:` 前缀：`import path from 'node:path'`。
- 未使用的 catch 参数以 `_` 前缀命名。
- 用 `?.` 做可选链检查，用 `??` 做空值合并；不要用 `&&` / `||` 模拟。
- 错误显式处理并保留上下文，不用 silent catch。
- JavaScript/TypeScript 工具链由 Vite+ 管理，配置在根 `vite.config.ts`；测试 API 从 `vite-plus/test` 导入。
- 提交使用 conventional commits；git hooks 正常执行，不跳过。

## 7.2 React

- 函数组件 + hooks，不使用 `React.FC`。
- Tailwind 条件类用 `cn()` 合并。
- 按钮必须写 `type="button"`，避免在表单中意外提交。
- 组件添加 `data-slot` 属性标识。
- UI 统一走 `shadcn/ui` 封装；不要直接使用 Radix 原语。

包级差异：

| 包 | 差异 |
| --- | --- |
| `packages/apps/react-app` | 状态用 Jotai，通知用 Sonner，UI 用 shadcn/ui |
| `packages/apps/i18n-studio` | 允许直接使用 Radix；状态走 loaders / actions，不引入 Jotai 等外部状态库；表单优先 React Router `Form` / `useFetcher`；通知用 Sonner |
| `packages/apps/docs-app` | 静态内容站，Markdown 管线在 `app/lib/docs.ts`，不引入客户端状态库 |
| `packages/apps/vela` | NSH 组件与 signals，规则见 `packages/apps/vela/AGENTS.md` |

## 7.3 Go

Go 只存在于 `go/` 与 `packages/apps/vela/core`。TS/React/Node 规范不适用于 Go 代码；Go 约定见 `go/AGENTS.md`，Vela core 的约定见 `packages/apps/vela/AGENTS.md`。
