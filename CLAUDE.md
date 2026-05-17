# CLAUDE.md

<!-- 参考本文件时：1) 涉及具体应用时先查应用规范 2) 涉及代码编写时查开发规范 3) 其他通用约定查其他规范 -->

## 应用规范

### react-app

- 状态用 Jotai
- 通知用 Sonner
- UI 用 shadcn/ui，不用 Radix UI

### artusx-api

- 依赖注入用 ArtusX
- 日志用 `this.logger`（service）或 `debug` 包
- 配置注入用 `AppConfig`（from `src/types/config.ts`）

### remix-api / remix-flow

- 部署：`wrangler deploy --minify`
- remix-api 用 Hono + Supabase + Dayjs

## 开发规范

### 构建命令

```bash
pnpm install
pnpm -F <pkg> build
pnpm -F <pkg> dev
pnpm lint
pnpm lint:fix
pnpm format:write
```

### TypeScript

- 用 `interface` 定义数据结构
- 避免 `any`，用 `unknown` 或具体类型
- 用 `const` 和 `readonly` 保持不可变

### React

- 函数组件 + hooks，不用 `React.FC`
- 用 `cn()` 处理 Tailwind 条件类
- 按钮必须加 `type="button"`
- 添加 `data-slot` 属性标识组件

### Node.js

- 用 `node:` 前缀导入内置模块：`import path from 'node:path'`
- 未使用的 catch 参数用 `_` 前缀

### 其他

- 用 `?.` 替代 `&&` 做可选链检查
- 用 `??` 做空值合并
- 错误用 try/catch 处理，不用 silent failures

## 其他规范

- 始终使用相对路径，不用绝对路径
- Oxlint 配置：`oxlint.json`、`.oxfmtrc.json`
- 提交用 conventional commits
- 浏览器测试后只关 tab，不关浏览器