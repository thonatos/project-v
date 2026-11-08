# Tasks

## 1. 固化归档策略

- [x] 1.1 更新根 `AGENTS.md` 的归档硬约束，明确有 delta 时先同步并校验、失败停止且不得跳过、完成态不重复确认；检查文件仍不超过 60 行并继续指向 `docs/8`。
- [x] 1.2 更新 `openspec/config.yaml` 的 `operations.archive.guidance`，展开未同步 delta 自动同步、同步后严格校验、失败停止和已完成时直接归档；运行 `openspec instructions archive --change enforce-spec-sync-before-archive --json`，逐项确认 `operationGuidance` 包含这些约束。
- [x] 1.3 更新 `docs/8-runbooks.md` 的归档前核对，写出“检查 delta → 同步 → strict 校验 → 归档”的顺序和 `--skip-specs` 边界；运行 `git diff --check`，并确认内容与根硬约束及 archive guidance 一致。

## 2. 流程验收与交付

- [x] 2.1 对三种状态做静态场景核对：未同步 delta 的唯一下一步是同步；已同步且完整的唯一下一步是归档；同步阻塞或 strict 失败的唯一下一步是停止。验证：根 `AGENTS.md` 与 `openspec instructions archive --change enforce-spec-sync-before-archive --json` 的 guidance 均不允许跳过同步或重复确认。
- [x] 2.2 运行 `openspec validate enforce-spec-sync-before-archive --strict`、`openspec validate --specs --strict` 与 `git diff --check`，确认退出码均为 0；本次没有 delta spec，不执行主规格同步。
- [x] 2.3 交付评估：无受影响产品包，版本结论为 `NONE` 且不更新版本来源；不修改 workflow、不打 tag；push `main` 会触发 docs-app connected build，但站点代码与产物逻辑不变，推送后核对自动构建成功；CI 无新增 gate。

## Workflow follow-up

- 所有任务完成后直接归档；该 change 没有 delta spec，因此无需同步主规格。
- 提交并推送流程配置与归档记录，确认工作区干净。
