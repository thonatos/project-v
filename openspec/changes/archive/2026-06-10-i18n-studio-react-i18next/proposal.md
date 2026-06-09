## Why

i18n-studio 自身的操作界面（公共外壳、落地页、Dashboard 框架）目前把 UI 文案硬编码在组件里，且中英文混杂。作为一款多语言翻译管理工具，自身界面却无法切换语言，也没有「吃自己的狗粮」——界面文案完全可以托管在 i18n-studio 自己的系统里。

本变更引入 react-i18next 搭建界面国际化基础设施，并进一步让 studio **用自己管理自己的界面文案**：提供 pull/push 脚本在「本地资源 ↔ studio 系统」间同步文案，前端浏览器运行时直接从 studio 的 snapshot 接口拉取最新文案。

注意：本变更针对 **studio 操作界面自身的多语言**；它恰好复用了 studio 管理「翻译数据」的同一套能力（namespace/entries/snapshot/token），形成自托管闭环。

## What Changes

**基础设施（react-i18next）**

- 引入 `i18next` + `react-i18next`（手写 cookie 方案，不引入 remix-i18next）。
- 镜像 theme cookie 模式：新增 `lang` cookie 读写助手与 `/api/lang` action，root loader 读取语言并 SSR 注入，避免 hydration mismatch；`<html lang>` 动态化。
- 头部新增语言切换控件；首批 key 化「公共外壳 + Dashboard 框架」文案。
- 支持 `zh-cn`（默认/回退）与 `en-us`。

**自托管闭环（新增需求 1、2）**

- 约定一个承载界面文案的 studio namespace（如 slug `studio-ui`），并提供 seed，把首批抽取的 key/文案灌入系统。
- 新增 **pull/push CLI 脚本**：
  - `push`：把本地资源文件（提取的 key/文案）通过 **import 接口**导入 studio 系统，使用新增的 **`write` scope token** 鉴权。
  - `pull`：从 studio 系统（**export / snapshot 接口**）拉取文案落地为本地资源文件。
- 新增 **`write` token scope**：扩展 token 模型（现仅 `readonly`/`task`），新增可吊销的窄权限写 token，并让 `import` 接口接受该 token；token 管理 UI 增加 `write` 选项。**BREAKING**：`api_tokens.scope` 的枚举集合变更，需 DB 迁移。
- 本地 JSON 资源定位调整为「pull 产物 + SSR/首屏 fallback」，构建时固化进 bundle 保证首屏与离线可用。
- **前端浏览器运行时**：hydration 后通过 i18next backend 从 **snapshot 接口**异步拉取最新文案并合并，使界面文案可在不重新构建/部署的情况下更新。

## Capabilities

### New Capabilities
- `ui-i18n`: studio 界面国际化能力——i18next 实例初始化、语言资源组织、SSR 注入与 hydration 一致性、cookie 持久化、语言切换、文案 key 化约定。
- `ui-i18n-sync`: 界面文案的自托管同步能力——pull/push 脚本（本地资源 ↔ studio 系统，经 import/export/snapshot 接口）、`write` scope token 鉴权，以及前端浏览器运行时从 snapshot 拉取并合并文案。

### Modified Capabilities
<!-- 无既有 spec；`write` token 作为 ui-i18n-sync 的一部分定义 -->

## Impact

- **依赖**：新增 `i18next`、`react-i18next`、`dotenv`（供 pull/push 脚本读取本地 `.env`）；浏览器运行时拉取用自写轻量 fetch（不引入 `i18next-http-backend`）。
- **数据库**：`api_tokens.scope` 枚举由 `['task','readonly']` 扩展为 `['task','readonly','write']`，需 `drizzle-kit generate` 生成迁移（SQLite text+enum 仅运行时校验，迁移影响小）。
- **新增文件**：`app/lib/i18n.ts`、`app/lib/i18n.server.ts`、`app/i18n/config.ts`、`app/i18n/locales/{zh-cn,en-us}/*.json`（pull 产物）、`app/routes/api.lang.tsx`、语言切换组件、`scripts/i18n-pull.mjs`、`scripts/i18n-push.mjs`、界面文案 seed、`.env.example`（记录 `STUDIO_BASE_URL` / `STUDIO_NAMESPACE` / `STUDIO_WRITE_TOKEN`）。
- **配置**：write token 等脚本凭据放在 `packages/apps/i18n-studio/.env`，由脚本经 `dotenv` 加载；目标 namespace slug 经 `STUDIO_NAMESPACE` 配置（默认 `studio-ui`），避免在脚本中写死。`.env` 加入该 app 的 `.gitignore`，仅提交 `.env.example`。
- **修改文件**：`app/root.tsx`、`app/entry.{client,server}.tsx`、`app/components/app-shell.tsx` 及首批被抽取组件、`app/routes.ts`、`app/db/schema.ts`（token scope）、`app/lib/api-token.server.ts`（生成/校验 `write`、`wr_` 前缀）、`app/routes/api.namespaces.$slug.import.tsx`（接受 `write` token）、`app/routes/api.namespaces.$slug.tokens._index.tsx` 及 token 管理 UI（`write` 选项）、`package.json`（新增 `i18n:pull` / `i18n:push`）。
- **接口**：pull 复用现有 `snapshot`（`studio-ui` 已 `public_read=1`，免 token）；push 复用 `import`，改为同时接受 session role 与 `write` token。
- **测试**：语言 cookie 助手单测、语言切换渲染/集成、`write` token 生成与校验、import 接受 write token 的鉴权测试、pull/push 脚本契约验证、浏览器运行时合并逻辑验证。
- **风险面**：SSR/CSR 语言一致性、首屏闪烁、运行时拉取二次闪烁、token 迁移与 `wr_` 前缀、write token 泄露的写入风险。本地可逆，无生产数据风险。

## Rollback Plan

- 纯增量、可逆：核心改动集中在新增文件与少量入口接线，外加一次 token scope 迁移。
- `git revert` 对应提交即可；移除 `i18next`/`react-i18next`、删除 `app/i18n/`、`api.lang` 路由、pull/push 脚本与 seed、关闭浏览器运行时拉取、`<html lang>` 恢复静态值、还原被抽取组件文案。
- **token 迁移回滚**：`write` 为枚举纯增项，回滚时还原 schema 重新 `generate` 即可；已签发的 write token 可在 UI 吊销或从 `api_tokens` 删除，不影响 `readonly`/`task` 既有 token。
- `studio-ui` namespace 与其 entries 是普通业务数据，删除 namespace 即可清理。残留 `lang` cookie 无害。
