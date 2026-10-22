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
6. **未经用户在当前会话中对具体外部路径和具体操作作出明确授权，不得主动读取、修改、复制、移动、删除或列出非本项目的用户文件、配置、日志、数据及其他项目**
7. 用户对某一外部路径或操作的授权仅覆盖该次明确范围，不得推导为对同目录、其他命令或后续操作的持续授权

### 全局工具例外

1. 允许调用系统命令和全局安装的开发工具，例如 `git`、`nsh`、`go`、`cargo`、`rustup`、`xcodebuild`、`codesign`、包管理器及编译器
2. 允许这些工具按自身正常机制使用全局运行时、SDK、工具链和依赖缓存；这不等同于授权代理主动浏览或修改缓存内容
3. 可以读取工具命令直接返回的版本、帮助、构建、测试和诊断输出；不得借此扩展为读取无关的项目外用户数据

### 临时产物规则

1. 构建中间文件、截图、日志、trace、测试 fixture 草稿和 smoke-test 输出必须写入当前项目内对应应用的 `.tmp/`，或任务明确指定的项目内临时目录
2. 项目内临时目录必须加入对应 `.gitignore`；未经用户确认，不得将临时产物转移为正式 fixture、测试基线、文档资源或提交内容
3. 禁止先写入 `/tmp`、`/private/var/...`、`~/Library/...` 等项目外临时目录后再复制回项目
4. 工具自行使用其标准缓存不受此限制；若任务产物或代理显式指定的临时输出必须写入项目外目录，执行前必须说明具体路径、用途和操作，并等待用户明确授权

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

### Vela

- UI 优先使用适合 macOS 密度的 NSH/原生组件；`nsh/ui/mobile` 中固定 44–48pt 触控密度的 `Button`、`Card`、`Group`、`ListView`、`TextField` 不得用于 Vela 桌面界面
- NSH 缺少桌面高层控件时，通过注册 native component 使用 AppKit 控件（如 `NSButton`），基础 `View`/`Text` 只用于紧凑布局和信息展示；`Alert`、`Modal` 可继续使用 NSH 的原生呈现能力
- UI 实现完成后优先验证 Core 通信、认证、设备管理、共享、设置与 WebView 等功能，再执行构建和类型检查
- 不使用截图、截图对比或视觉基线作为 Vela UI 验收方式；除非用户明确要求，否则不得生成、读取或分析 Vela UI 截图

### go/artusx-api（Go 版）

- Web 框架用 **echo**；依赖注入用**手动构造注入**（不引入 wire 等 DI 框架）
- 模板用标准库 `html/template` + `go:embed`（不用 Nunjucks）
- Telegram 用 **Bot API**（标准库 `net/http` 直调，不用 MTProto）
- 配置从环境变量读取（`config/config.go`）；监听 `7001`，并存靠部署侧端口映射
- 目录遵循 Go 社区惯例：入口放 `go/cmd/<app>/main.go`（薄入口 + Dockerfile 等部署产物）；业务代码放 `go/internal/<app>/`（本 module 私有，含单服务业务与跨服务共享包）。**无 `apps/`、无 `service/` 层**
- module path 为 `implements.io/projectv`（本服务业务即 `implements.io/projectv/internal/artusx-api/*`）

## 开发规范

### 构建命令

```bash
pnpm install
pnpm -F <pkg> build
pnpm -F <pkg> dev
pnpm check
pnpm lint
pnpm lint:fix
pnpm format:write
pnpm test
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

### Go（仅 `go/` 目录）

- 上述 TS/React/Node.js 规范均**不适用**于 Go 代码
- 格式化用 `gofmt`（提交前 Vite+ hook 会校验 staged 的 `*.go`）
- 静态检查用 `golangci-lint`（v2，配置 `go/.golangci.yml`；装了才在 pre-commit 跑）
- 错误显式处理并 `%w` 包装，不 silent failures
- 编译检查用 `go build ./...`；测试 `go test ./...`；lint `golangci-lint run ./...`（需装 golangci-lint v2）
  - 说明：因 `cmd/` + `internal/` 布局下二进制名（`artusx-api`）不与 `go/` 顶层目录同名，`go build ./...` 与 `go build ./cmd/<app>` 均可正常产出，无同名冲突

### 其他

- 用 `?.` 替代 `&&` 做可选链检查
- 用 `??` 做空值合并
- 错误用 try/catch 处理，不用 silent failures

## 其他规范

- JavaScript/TypeScript 通用工具由 Vite+ 管理，配置位于根 `vite.config.ts`
- 测试 API 从 `vite-plus/test` 导入；运行全仓测试使用 `pnpm test`
- 提交用 conventional commits
- 浏览器测试后只关 tab，不关浏览器
- Git 提交：正常提交，使用 git hooks 验证，禁止跳过
