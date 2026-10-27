# 1. 架构

> 本文件描述跨包的稳定事实。单包细节留在包内 `docs/` 与包级 `AGENTS.md`。

## 1.1 仓库与包地图

仓库由一个 pnpm workspace（`packages/**`）和一个独立 Go module（`go/`）组成。`packages/apps/vela` 内部还有自己的 Go module（`implements.io/vela`）。

| 路径 | 运行时 | 职责 | 部署方式 |
| --- | --- | --- | --- |
| `packages/apps/react-app` | React Router 7 + Vite+ | 全栈 React 应用（tiptap、wagmi、Jotai） | 无部署配置；`deploy` 脚本等同构建 |
| `packages/apps/docs-app` | React Router 7 SSG + Cloudflare Workers | 个人知识站，Markdown 文章站 | 手动 `wrangler deploy` |
| `packages/apps/i18n-studio` | React Router 7 全栈 + SQLite / Drizzle | 多语言词条协作平台 | 手动 Docker 部署（见包内 `app/docs/deployment.md`） |
| `packages/apps/artusx-api` | Node + ArtusX | 旧版 Web / Webhook 服务 | 阿里云 Docker 镜像（push `main` 自动） |
| `packages/apps/remix-api` | Hono + Supabase + Cloudflare Workers | API 服务 | 手动 `wrangler deploy` |
| `packages/apps/remix-flow` | Cloudflare Workers + Puppeteer | 页面抓取与流程触发 | 手动 `wrangler deploy` |
| `packages/apps/vela` | NSH（TSX UI）+ Rust host + Go core | macOS / iOS 私人网络访问客户端 | GitHub Release + 本地安装 |
| `packages/libs/bot` | Node CLI | Telegram bot 辅助 | 无 |
| `packages/libs/react-component` | React + Storybook | 内部 React 组件 | 无 |
| `packages/libs/utils` | Node | JWT 等内部工具 | 无 |
| `packages/plugins/dsh-telegram` | dsh 插件（npm 公开包） | Telegram 私聊集成 | 手动 npm 发布 |
| `packages/tools/gpm` | scriptc 原生 CLI | Git 仓库目录管理 | 本地构建二进制 |
| `go/` | Go module `implements.io/projectv` + echo | Go 版 artusx-api | 阿里云 Docker 镜像（push `main` 自动） |

workspace 的 glob 与版本钉在 `pnpm-workspace.yaml`：`packages/apps/*`、`packages/libs/*`、`packages/plugins/*`、`packages/tools/*`，`vite-plus` 通过 catalog 固定。

## 1.2 运行拓扑

```text
浏览器 / 客户端
      |
      +--> Cloudflare Workers      docs-app / remix-api / remix-flow
      |
      +--> Docker                  artusx-api（Node / Go）、i18n-studio
      |
      +--> 本地进程                react-app、gpm
      |
      +--> Vela 客户端
             NSH（TSX UI） -> Rust host -> Go core -> tailscale/tsnet
```

- `i18n-studio` 是单进程全栈应用，数据落在 `data/i18n.db`（WAL），没有外部数据库服务。
- `vela` 两端共享 `shared/` 与 `core/`，但平台目录各自独立打包：macOS 是完整 `.app`，iOS 通过 Xcode 工程与 C ABI 接入。
- `go/cmd/artusx-api` 是薄入口，业务在 `go/internal/artusx-api/**`；它同时并存于 Node 版 `packages/apps/artusx-api`，两者共用 Telegram Bot API 协议。

## 1.3 依赖方向

- **workspace 包之间**：当前没有 `workspace:` 依赖。若新增，方向只能是 `apps / plugins / tools -> libs`，`libs` 不得反向依赖应用。
- **Vela 内部**：

  ```text
  macos/**, ios/**   ->  shared/**, core/**     允许
  shared/**, core/** ->  macos/**, ios/**       禁止
  macos/**           ->  ios/**                 禁止
  ```

- **Go**：`cmd/` 依赖 `internal/`，`internal/` 不得依赖 `cmd/`。根 module 与 Vela core（`implements.io/vela`）是两个独立 module，彼此不得直接 import。
- **文档与规格**：`docs/` 与 `openspec/specs/` 不构成运行时依赖；规格描述行为，文档描述操作。
