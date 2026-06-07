## Why

当前仓库尚无统一的多语言词条管理能力，文案散落在各应用中，缺少协作流程，且难以扩展新语言或按命名空间隔离。需要一个支持多命名空间、多用户协作、可扩展语言的独立应用，便于团队按角色协作维护翻译，并以最小依赖（SQLite）实现自托管。

## What Changes

- 新增独立 app `packages/apps/i18n-studio`，基于 **React Router v7 全栈** 同时提供后端 API 与前端管理界面
- 使用 **SQLite + Drizzle ORM** 作为持久化（单文件数据库，便于本地与小团队部署）
- 默认内置 `zh-cn`、`zh-tw`、`en-us` 三种语言，并通过命名空间配置扩展更多语言（统一使用 BCP-47 风格小写 `xx-xx` 格式）
- 词条 key 采用 flat 模式，单条 key 可包含层级（如 `home.title.subtitle`），不嵌套树形结构存储
- 引入用户—命名空间多对多关系，支持三种角色：管理员（admin）、编辑（editor）、访客（viewer）
- **词条版本控制**：每次翻译变更生成版本记录（按 entry+locale 维度），区分"已发布(published)"与"草稿(draft)"两种状态——只有"已发布"版本对外生效；同步、外部任务回写默认进入 draft，由用户显式 publish 后才上线。支持查看历史、对比、回滚到任一旧版本
- **批量翻译任务（外部执行）**：支持基于筛选条件（前缀/缺失语言）批量选中词条 → 创建"翻译任务"记录（包含目标 locale、词条快照、状态机），系统**不内建翻译执行器**，由外部 job（机翻 / 人工翻译 / CLI 等）通过 API 拉取任务并回写翻译结果，应用自身只负责任务的存储、状态流转、回写校验与归档
- **跨命名空间词条同步**：从源命名空间向目标命名空间同步词条（一次性拷贝）；写入后翻译以 **draft 版本**形式落地，**默认不直接生效**；目标空间用户审阅后显式 publish 才正式上线。支持 key 前缀 / entry_id 白名单过滤、目标 locale 子集、冲突策略（跳过 / 覆盖 / 仅填补缺失）与 dry-run 预览
- 以 React Router resource routes（`*.json` loader/action）形式提供命名空间、语言、词条、版本、任务、同步的 CRUD 与批量导入/导出
- **客户端快照读取通道（`/snapshot/...`）**：与管理 API 路径独立的只读、可缓存通道，仅返回 published；命名空间可选 `public_read=true` 公开匿名读取，或通过 `scope=readonly` 的 API token 访问；引入命名空间级 `bundle_version` 配合 ETag/304 用于客户端缓存
- 提供基础管理 UI：登录、命名空间列表、成员管理、词条编辑（含历史/回滚/批量选择/创建翻译任务/批量推送）、翻译任务列表（查看状态、取消、查看回写结果）、同步对话框、Publish/Discard 草稿、命名空间设置（含 `public_read` 开关与 API token 管理）、导入导出
- 不修改既有 `artusx-api` / `remix-api` / `react-app` / `docs-app`

## Capabilities

### New Capabilities

- `i18n-entry-management`：多语言词条管理核心能力（命名空间、语言配置、词条 CRUD、flat key 校验、批量导入导出、版本控制 + 草稿/发布工作流、批量翻译任务契约、跨空间同步、客户端快照通道与 `bundle_version`）
- `i18n-namespace-membership`：命名空间—用户成员关系、角色授权与 API token（含 `task` / `readonly` 两种 scope）

### Modified Capabilities

<!-- 无既有 spec 行为变更 -->

## Impact

- **新建独立应用**：在 `packages/apps/` 下新增 `i18n-studio`，使用 React Router v7 全栈模式（loaders/actions 承载后端，路由组件承载前端 UI）
- **数据存储**：使用 SQLite 作为持久化（本地文件 `data/i18n.db`），通过 Drizzle ORM 管理 schema 与迁移
- **配置**：新增语言列表配置项（默认 `zh-cn,zh-tw,en-us`），通过环境变量与命名空间内配置覆盖
- **API**：以 React Router 资源路由形式（`*.json` / `action`）对外提供 REST 风格 JSON 管理接口
- **客户端快照通道**：独立路径 `/snapshot/...`，绕开管理 cookie 会话，支持匿名（公开命名空间）或 `scope=readonly` Bearer token，配合 ETag/304 与 `bundle_version` 实现客户端可缓存读取
- **依赖新增**：`react-router`、`@react-router/node`、`@react-router/serve`、`better-sqlite3`、`drizzle-orm`、`drizzle-kit`、`zod`、`argon2`、`ulid`、`tailwindcss`、`shadcn/ui` 相关组件
- **不复用现有应用**：不修改 `artusx-api` / `remix-api` / `react-app` / `docs-app`
- **回滚计划**：
  - 该 app 完全独立，回滚仅需停部署 + 删除 `packages/apps/i18n-studio` 目录与对应 workspace 引用
  - SQLite 数据库为单文件，回滚直接备份/移除该文件即可
  - 不影响其它 app 的构建与运行
