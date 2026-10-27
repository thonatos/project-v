# project-v

个人 monorepo：知识站、多语言词条平台、若干服务，以及 macOS / iOS 客户端 Vela。

## 快速开始

```bash
# 需要 Node.js >= 24.11 与 pnpm 12
pnpm install
pnpm check        # 格式、lint、类型检查
pnpm test         # i18n-studio / gpm / dsh-telegram 的测试项目
pnpm -F <pkg> dev # 启动单个应用
```

Vela、Go 与各应用的额外前置条件见 [`docs/2-development.md`](docs/2-development.md)。

## 包地图

| 包 | 用途 | 运行 | 部署 | 文档 |
| --- | --- | --- | --- | --- |
| `packages/apps/react-app` | 全栈 React 应用 | `pnpm -F react-app dev` | 仅构建 | [README](packages/apps/react-app/README.md) |
| `packages/apps/docs-app` | 个人知识站（SSG） | `pnpm -F docs-app dev` | `pnpm -F docs-app deploy` | [AGENTS](packages/apps/docs-app/AGENTS.md) |
| `packages/apps/i18n-studio` | 多语言词条协作平台 | `pnpm -F i18n-studio dev` | 手动 Docker | [AGENTS](packages/apps/i18n-studio/AGENTS.md) |
| `packages/apps/artusx-api` | Web / Webhook 服务（Node） | `pnpm -F artusx-api dev` | 阿里云镜像（push `main`） | [README](packages/apps/artusx-api/README.md) |
| `packages/apps/remix-api` | API 服务（Cloudflare Workers） | `pnpm -F remix-api dev` | `pnpm -F remix-api deploy` | [README](packages/apps/remix-api/README.md) |
| `packages/apps/remix-flow` | 页面抓取与流程触发 | `pnpm -F remix-flow dev` | `pnpm -F remix-flow deploy` | [README](packages/apps/remix-flow/README.md) |
| `packages/apps/vela` | macOS / iOS 私人网络客户端 | 见包内 README | GitHub Release | [AGENTS](packages/apps/vela/AGENTS.md) |
| `packages/libs/bot` | Telegram bot 辅助 | `pnpm -F bot start` | 无 | — |
| `packages/libs/react-component` | React 组件库 + Storybook | `pnpm -F react-component storybook` | 无 | [README](packages/libs/react-component/README.md) |
| `packages/libs/utils` | 内部 JWT 工具 | `pnpm -F utils start` | 无 | — |
| `packages/plugins/dsh-telegram` | dsh Telegram 私聊插件 | `pnpm -F dsh-telegram build` | 手动 npm 发布 | [README](packages/plugins/dsh-telegram/README.md) |
| `packages/tools/gpm` | Git 仓库目录管理 CLI | `pnpm -F gpm build` | 本地构建 | [README](packages/tools/gpm/README.md) |
| `go/` | Go 版 artusx-api（echo） | `cd go && go build ./...` | 阿里云镜像（push `main`） | [AGENTS](go/AGENTS.md) |

发布通道与版本规则见 [`docs/5-release.md`](docs/5-release.md)，CI 门禁见 [`docs/4-ci-cd.md`](docs/4-ci-cd.md)。

## 仓库文档

工程文档在 [`docs/`](docs/README.md)，只服务仓库内部，不参与 `docs-app` 构建。入口：

- 架构与依赖方向：[`docs/1-architecture.md`](docs/1-architecture.md)
- 工具链与命令：[`docs/2-development.md`](docs/2-development.md)
- 测试边界：[`docs/3-testing.md`](docs/3-testing.md)
- CI / CD：[`docs/4-ci-cd.md`](docs/4-ci-cd.md)
- 发布与版本：[`docs/5-release.md`](docs/5-release.md)
- 交付与修 bug 流程：[`docs/8-runbooks.md`](docs/8-runbooks.md)

## 约定

- 提交使用 conventional commits，git hooks 正常执行。
- 修改代码前先读根 [`AGENTS.md`](AGENTS.md) 与目标路径下最近的包级 `AGENTS.md`。
- 行为契约在 `openspec/specs/`，操作知识在 `docs/`，两者不互相复制。
