## Why

i18n-studio 的词条同步心智模型已经收敛为 `extract -> push -> pull`,但当前 `packages/apps/i18n-studio/scripts/` 同时放置工作流入口、构建期 codegen 和纯 helper,让目录结构看起来像存在额外流程步骤。现在需要把可执行入口、构建工具和可复用纯逻辑分层,让工作流更容易理解,同时保留离线构建与类型安全能力。

## What Changes

- 收敛 `scripts/` 目录语义:仅保留面向词条同步的可执行入口,即 `i18n-push.ts` 与 `i18n-pull.ts`。
- 将 `i18n-flatten.ts` 与 `i18n-sync-core.ts` 迁移到 `app/lib/i18n-sync/`,作为领域纯逻辑,供 push/pull、seed 和单测复用。
- 将 `i18n-codegen.ts` 迁移到项目级 `tools/`,定位为构建期派生工具,不再混在词条工作流入口目录里。
- 调整 `i18n:pull` 编排,使 pull 在成功更新本地资源与 `_meta.json` 后自动刷新 `app/i18n/generated.ts`;开发者主流程只需要执行 `i18n:pull`。
- 保留 `i18n:codegen` 作为低层构建/调试命令,并继续由 `build` / `typecheck` 前置调用,保证 fresh clone / CI 离线可构建。
- 更新文档和测试,明确一等词条工作流为 `extract -> push -> pull`,codegen 是 pull/build/typecheck 的内部派生动作。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `ui-i18n-sync`: pull 脚本完成后应自动刷新生成物,并且文档化的一等词条工作流只包含 `extract`、`push`、`pull`。
- `i18n-locale-codegen`: codegen 能力保持构建期派生器定位,其入口迁移到项目工具目录,继续支持离线运行并被 build/typecheck 编排。

## Impact

- 影响 `packages/apps/i18n-studio/package.json` 中 `i18n:*`、`build`、`typecheck` 命令路径与组合。
- 影响 `packages/apps/i18n-studio/scripts/`、新增或使用 `packages/apps/i18n-studio/tools/`、新增 `packages/apps/i18n-studio/app/lib/i18n-sync/`。
- 影响 push/pull/seed 脚本与相关单测的 import 路径。
- 影响 `app/docs/guide.md` 中界面文案同步章节的流程说明。
- 不改变数据库 schema、HTTP API、snapshot 响应结构、运行时 i18next 行为或翻译数据格式。

## Rollback Plan

- 如迁移后脚本路径或 import 出现问题,可按文件粒度将 helper 与 codegen 移回 `scripts/`,并恢复 package.json 命令。
- 如 `i18n:pull` 自动 codegen 引入联动失败,可临时恢复为只运行 pull 并在文档中提示手动执行 `i18n:codegen`;构建链仍可通过 `build` / `typecheck` 前置 codegen 兜底。
- 由于本变更不改数据模型和 API,回滚不需要数据库迁移或线上数据修复。
