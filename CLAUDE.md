# CLAUDE.md

<!-- 参考本文件时：1) 涉及具体应用时先查应用规范 2) 涉及代码编写时查开发规范 3) 其他通用约定查其他规范 -->

## 安全规范

目录访问强制约束

### 核心权限规则

1. 所有文件读写、编辑、查找、命令操作**仅限当前项目根目录及下属子目录**
2. 严禁使用 `../`、绝对路径、用户目录 `~`、系统路径跨目录访问
3. 禁止读取、修改、删除、列出当前目录以外任何文件与文件夹
4. 生成代码、脚本、终端命令里的文件路径，仅使用相对当前目录简写路径，禁止越级
5. 若出现跨目录操作需求，直接拒绝执行并提示：仅允许操作当前目录范围内文件

### 执行规范

1. 遍历、搜索文件仅在本级目录内执行
2. 路径统一使用同级/下级相对路径，禁用上级回溯路径
3. 全局查找、系统文件读取、跨项目文件调用一律禁止

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

### i18n-studio

- React Router v7 全栈 + SQLite + Drizzle ORM（better-sqlite3）
- 构建：`pnpm -F i18n-studio build` / `dev` / `start` / `typecheck` / `db:generate` / `test`
- 数据存储：`data/i18n.db`（WAL），加入该 app 的 `.gitignore`
- 状态走 loaders/actions，**不**引入 Jotai 等外部状态库
- UI 用 shadcn/ui + Radix（该 app 内放宽全局"不用 Radix UI"约束）
- 通知用 Sonner；表单优先 React Router `Form` / `useFetcher`

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

- Oxlint 配置：`oxlint.json`、`.oxfmtrc.json`
- 提交用 conventional commits
- 浏览器测试后只关 tab，不关浏览器
- Git 提交：正常提交，使用 git hooks 验证，禁止跳过
- Oxlint 配置：`oxlint.json`、`.oxfmtrc.json`
