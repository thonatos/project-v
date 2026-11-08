# docs-app Agent Guidelines

本文件适用于 `packages/apps/docs-app/**`，在仓库根 `AGENTS.md` 之上补充本地规则。

## 边界

- 拥有：`app/docs/**`（公开文章源）、`app/routes/**`、`app/lib/docs.ts`（Markdown 管线）、`app/components/**`、`wrangler.jsonc`。
- 不拥有：根 `docs/`。**仓库工程文档不得放进 `app/docs/`**；反过来，`docs/` 也不参与本站构建。
- 内容模型：`app/docs/*.md`，文件名即 slug；frontmatter 支持 `title`、`date`、`description`、`tags`、`type`（`blog` / `docs`）、`category`、`layout`（`reading` / `wide`）。Blog 的 `category` 只使用 `engineering` / `markets`，Docs 使用目录分类；`tags` 是兼容元数据，不参与公开导航。
- 公开路由：Docs 使用 `/docs`、`/docs/:slug`，Blog 使用 `/blog`、`/blog/:slug`，项目使用 `/projects` 与专用项目路由；历史 Blog 和 Tags 地址只提供迁移页。
- 站点为 SSG，构建产物在 `build/client`，由 Cloudflare Workers 静态资源提供。

## 本地约束

- 新增文章放 `app/docs/`，不要新增平行内容目录；`docsDir` 在 `app/lib/docs.ts` 中固定为 `app/docs`。
- Markdown 管线使用 unified / remark / rehype；改渲染行为时同步检查 TOC、代码高亮与 frontmatter 归一化。
- 不引入客户端状态库；站点数据由路由 loader 提供。
- 移动端与桌面端的布局由 `layout` 字段与既有页面容器控制，不在单篇文章里堆叠特殊容器。Docs 强调查找，Blog 强调栏目和时间，Projects 可在统一站点外壳内使用项目品牌。

## 验证入口

| 变更类型 | 命令                         | 期望结果                      |
| -------- | ---------------------------- | ----------------------------- |
| 开发     | `pnpm -F docs-app dev`       | 本地可访问文章页              |
| 构建     | `pnpm -F docs-app build`     | 退出码 0，`build/client` 生成 |
| 类型     | `pnpm -F docs-app typecheck` | 退出码 0                      |
| 生产预览 | `pnpm -F docs-app start`     | 本地以构建产物启动            |
| 部署     | `pnpm -F docs-app deploy`    | 手动 `wrangler deploy` 成功   |

本应用没有自动化测试；页面行为以构建、类型检查与目标视口的人工验证为准。路由或导航改动还需直接访问规范 URL 和历史迁移 URL。

功能开发、页面调试和人工 review 默认使用 `pnpm -F docs-app dev`，保持服务运行并通过 HMR 验证改动，不为每次样式或文案调整重复执行生产构建、停止和重启服务。最终交付前再运行 `pnpm -F docs-app typecheck` 与 `pnpm -F docs-app build` 验证类型和 SSG 产物；只有需要核对生产产物本身时才使用 `pnpm -F docs-app start`。

## CI 映射

| 路径          | workflow                  | 必过门                                                      |
| ------------- | ------------------------- | ----------------------------------------------------------- |
| `packages/**` | `nodejs-ci.yml` → `build` | `pnpm check`、`pnpm test`、`pnpm -r --filter '!vela' build` |
| 部署          | 无 CI gate                | 手动 `wrangler deploy`                                      |

## 发布与验收

- 包版本不构成交付契约（见 `docs/5.2`）；判定为 `NONE` 并写理由。
- 部署后在目标 URL 检查 Docs、Blog、Projects、历史迁移页与移动端视口；不能只凭本地构建判断已完成。
