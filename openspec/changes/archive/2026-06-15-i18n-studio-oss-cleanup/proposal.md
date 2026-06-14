## Why

i18n-studio 功能已基本完备，但工程外观仍像"内部玩具"而非现代开源项目，主要体现在三处：

1. **package.json scripts 杂乱** —— 14 条脚本扁平堆叠、命名分组不一致，且包含两个 CI 已移除、无人调用的死脚本（`check:openapi-coverage`、`check:doc-contracts`）。
2. **脚本运行策略割裂** —— `scripts/` 用 `.mjs` + 手写 `.d.mts`，`app/scripts/` 用 `.ts` + `tsx`。两套并存的唯一理由（mjs 免编译）在项目已依赖 `tsx` 的前提下不再成立，手写 `.d.mts` 还要与 `.mjs` 源手动同步签名，是纯维护负担。
3. **README 与 docs 重复、且引用幽灵脚本** —— `app/docs/`（运行时 `/docs` 站源）已完整覆盖能力清单、UI、工作流、语言库、API、路径、环境变量、部署等深度内容，但 143 行的 README 几乎逐条重抄，还引用了 package.json 中根本不存在的 `repair:locales` 脚本。

本次变更不触碰任何业务逻辑与 API，仅做工程结构现代化：统一脚本运行策略、整理 scripts、确立 `app/docs/` 为唯一文档源、README 退化为简洁的开源门面。

## What Changes

- **统一脚本为 TypeScript**：`scripts/*.mjs` 全部改为 `*.ts`，通过既有的 `tsx` 运行；删除两个手写的 `.d.mts` 声明文件（类型由 `.ts` 源直接提供）。`app/scripts/*.ts` 保持不动。
- **删除死脚本**：移除 `scripts/check-openapi-coverage.mjs`、`scripts/check-doc-contracts.mjs` 及其在 package.json 中的 `check:*` 条目（CI 已不引用，无其他调用方）。
- **整理 package.json scripts**：按生命周期分组（dev / database / i18n sync / test / ops），更新 `i18n:codegen`、`i18n:push`、`i18n:pull` 的执行命令从 `node *.mjs` 到 `tsx *.ts`。
- **修正测试导入**：`tests/unit/i18n-sync.test.ts`、`tests/unit/i18n-sync-core.test.ts` 的 import 路径从 `.mjs` 改为 `.ts`。
- **README 退化为门面**：精简为定位 + 特性 bullet + quickstart（install/dev/build）+ 指向 `app/docs` / 运行时 `/docs` 的链接 + license；删除幽灵脚本 `repair:locales` 段落与所有已在 `app/docs/` 覆盖的深度内容。
- **确立 `app/docs/` 为唯一文档源**：不新增独立 `docs/` 目录；贡献者测试结构不做文档化（`tests/` 目录自解释）。

## Non-goals

- 不修改任何业务逻辑、service 层、API 路径或数据模型。
- 不改动 `app/scripts/` 下已是 `.ts` 的脚本。
- 不重写 `app/docs/` 内容（仅作为 README 内容的承接目标，已验证覆盖完整）。
- 不把 `check:*` 契约校验接回 CI（已确认删除）。

## Impact

- **scripts/**：6 个 `.mjs` → 4 个 `.ts`（2 个删除）+ 删除 2 个 `.d.mts`。
- **package.json**：scripts 段重写（14 → 12 条，分组化）。
- **tests/**：2 处 import 路径更新。
- **README.md**：143 行 → 约 40 行门面。
- **构建链验证点**：`build`/`typecheck` 依赖 `i18n:codegen`，脚本改名后必须确保 build 链仍通过；`i18n:push`/`pull`/`seed`、`release:backfill` 为运维脚本，改名后命令需对应更新。

## Rollback Plan

- 本变更纯工程结构调整、additive 风险低；如出现问题可按文件粒度回退。
- 脚本改名是主要风险点：若 `tsx scripts/i18n-codegen.ts` 在 build 前置环节异常，可临时改回 `.mjs` 调用（git 保留原文件历史），不影响应用运行时。
- README/docs 调整无运行时影响，可独立回退。
- 删除的 `check:*` 脚本如未来需要，可从 git 历史恢复并重新接入 CI。
