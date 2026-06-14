## 1. 迁移 i18n 同步纯逻辑

- [x] 1.1 新建 `packages/apps/i18n-studio/app/lib/i18n-sync/`
- [x] 1.2 将 `scripts/i18n-flatten.ts` 迁移为 `app/lib/i18n-sync/resources.ts`,保留 `flatten` / `unflatten` 行为与类型签名
- [x] 1.3 将 `scripts/i18n-sync-core.ts` 迁移为 `app/lib/i18n-sync/workflow.ts`,保留 `diffNewEntries` / `fillPlaceholders` 行为与类型签名
- [x] 1.4 更新 `scripts/i18n-push.ts`、`scripts/i18n-pull.ts`、`app/scripts/seed-studio-ui.ts` 的 helper import
- [x] 1.5 更新 `tests/unit/i18n-sync.test.ts`、`tests/unit/i18n-sync-core.test.ts` 的 helper import
- [x] 1.6 删除迁移后的 `scripts/i18n-flatten.ts` 与 `scripts/i18n-sync-core.ts`,确认 `scripts/` 不再包含 helper 文件

## 2. 迁移 codegen 工具并收敛命令

- [x] 2.1 新建 `packages/apps/i18n-studio/tools/`
- [x] 2.2 将 `scripts/i18n-codegen.ts` 迁移到 `tools/i18n-codegen.ts`,保持输出 `app/i18n/generated.ts` 的行为不变
- [x] 2.3 更新 `package.json` 中 `i18n:codegen` 为 `tsx tools/i18n-codegen.ts`
- [x] 2.4 保持 `build` / `typecheck` 前置执行 `pnpm i18n:codegen`
- [x] 2.5 更新 `i18n:pull` 命令,使其在 `tsx scripts/i18n-pull.ts` 成功后执行 `pnpm i18n:codegen`
- [x] 2.6 更新 `scripts/i18n-pull.ts` 注释与完成日志,移除“请运行 i18n:codegen”的人工后续步骤提示

## 3. 更新文档与契约引用

- [x] 3.1 更新 `packages/apps/i18n-studio/app/docs/guide.md` 的界面文案同步流程图,将 codegen 表达为 pull 内部派生动作
- [x] 3.2 更新 guide 的 pull 命令示例,只展示 `pnpm -F i18n-studio i18n:pull`
- [x] 3.3 更新相关代码注释中对 `scripts/i18n-codegen.ts`、`scripts/i18n-flatten.ts`、`scripts/i18n-sync-core.ts` 的旧路径引用
- [x] 3.4 使用 `rg` 检查仓库内无旧 helper/codegen 路径残留,历史 archive 除外

## 4. 验证

- [x] 4.1 运行 `pnpm -F i18n-studio i18n:codegen`,确认迁移后的 tools 入口可生成 `app/i18n/generated.ts`
- [x] 4.2 运行 `pnpm -F i18n-studio typecheck`,确认脚本、tools、app lib 与测试 import 均通过类型检查
- [x] 4.3 运行 `pnpm -F i18n-studio test -- tests/unit/i18n-sync.test.ts tests/unit/i18n-sync-core.test.ts`,确认迁移后的纯函数行为不变
- [x] 4.4 如本地环境具备 `STUDIO_BASE_URL`,运行或手动验证 `pnpm -F i18n-studio i18n:pull` 在成功 pull 后会刷新 `generated.ts`
- [x] 4.5 抽查 `packages/apps/i18n-studio/scripts/` 目录,确认只剩 `i18n-push.ts` 与 `i18n-pull.ts`
