## 1. 统一脚本为 TypeScript

- [x] 1.1 `scripts/i18n-flatten.mjs` → `i18n-flatten.ts`，删除 `i18n-flatten.d.mts`，将类型直接写入 `.ts` 源（函数签名内联，无需独立声明）
- [x] 1.2 `scripts/i18n-sync-core.mjs` → `i18n-sync-core.ts`，删除 `i18n-sync-core.d.mts`
- [x] 1.3 `scripts/i18n-codegen.mjs` → `i18n-codegen.ts`
- [x] 1.4 `scripts/i18n-push.mjs` → `i18n-push.ts`（注意其 import `./i18n-flatten` `./i18n-sync-core` 的扩展名同步更新）
- [x] 1.5 `scripts/i18n-pull.mjs` → `i18n-pull.ts`（同上）
- [x] 1.6 转换过程中将 JS 中的隐式类型补成显式 TS 类型，避免 `any`；遵循项目 `node:` 前缀与 `interface` 约定

## 2. 删除死脚本

- [x] 2.1 删除 `scripts/check-openapi-coverage.mjs`
- [x] 2.2 删除 `scripts/check-doc-contracts.mjs`

## 3. 整理 package.json

- [x] 3.1 按生命周期分组重写 scripts：dev（dev/build/start/typecheck）、database（db:generate/db:migrate）、i18n sync（codegen/extract/extract:ci/push/pull/seed）、test（test/test:watch）、ops（release:backfill）
- [x] 3.2 更新 `i18n:codegen` → `tsx scripts/i18n-codegen.ts`
- [x] 3.3 更新 `i18n:push` → `pnpm i18n:extract && tsx scripts/i18n-push.ts`
- [x] 3.4 更新 `i18n:pull` → `tsx scripts/i18n-pull.ts`
- [x] 3.5 删除 `check:openapi-coverage`、`check:doc-contracts` 两条

## 4. 修正测试导入与连带引用

- [x] 4.1 `tests/unit/i18n-sync.test.ts`：`../../scripts/i18n-flatten.mjs` → 去扩展名
- [x] 4.2 `tests/unit/i18n-sync-core.test.ts`：`../../scripts/i18n-sync-core.mjs` → 去扩展名
- [x] 4.3 `app/scripts/seed-studio-ui.ts`：`../../scripts/i18n-flatten.mjs` import → 去扩展名（实现中发现的遗漏引用）
- [x] 4.4 `tests/unit/operational-readiness.test.ts`：移除对已删除 `check-openapi-coverage.mjs` / `check-doc-contracts.mjs` 的测试用例及 `spawnSync` import（与 spec delta 一致）

## 5. README 退化为开源门面

- [x] 5.1 重写 `README.md`：定位一句话 + 特性 bullet（6 条）+ Quick start（install/dev/build/start）+ 指向 `app/docs/` 与运行时 `/docs` 的文档链接 + license
- [x] 5.2 删除幽灵脚本 `repair:locales` 相关段落（"升级注意"小节）
- [x] 5.3 删除已被 `app/docs/` 覆盖的深度内容（核心能力详表、UI、语言库、路径表、环境变量表、数据备份、客户端消费示例、容器化部署细节）
- [x] 5.4 确认 README 不再文档化 `tests/` 目录结构（贡献者信息按决定不保留）

## 6. 验证

- [x] 6.1 `pnpm -F i18n-studio i18n:codegen` 通过（脚本改名后构建前置正常）
- [x] 6.2 `pnpm -F i18n-studio build` 通过（需 `SESSION_SECRET`，既有生产门禁，非本次回归）
- [x] 6.3 `pnpm -F i18n-studio typecheck` 通过（含 `.ts` 脚本与测试的类型，验证删除 `.d.mts` 后无类型缺失）
- [x] 6.4 `pnpm -F i18n-studio test` 通过（208 测试全绿，含修正 import 的 sync 单测与精简后的 operational-readiness）
- [x] 6.5 `oxlint lint packages`（根 `lint` 脚本）对 7 个改动文件 0 warning / 0 error
- [x] 6.6 抽查 `scripts/` 目录确认无残留 `.mjs` / `.d.mts`
