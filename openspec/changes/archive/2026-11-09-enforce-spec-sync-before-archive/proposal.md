# Proposal

## Why

项目的归档策略没有写入 OpenSpec 生命周期的权威配置：通用归档资源允许跳过 delta spec 同步，也会在任务和规格均完成时重复询问，导致 agent 可能归档未同步的行为契约或把既定流程重新交给用户决策。需要在项目层明确不可绕过的“同步、校验、归档”顺序。

## What Changes

- 在 `openspec/config.yaml` 的 archive guidance 中规定：发现未同步 delta 时直接同步，验证全部主规格后才归档；同步阻塞或验证失败时停止，不得跳过同步归档。
- 规定 delta 已同步且 artifacts/tasks 完整时直接归档，不重复询问是否同步或是否归档。
- 在 `docs/8-runbooks.md` 中记录同一顺序，并明确 `--skip-specs` 只适用于没有 delta 的 `skip_specs: true` 流程变更。
- 在根 `AGENTS.md` 增加归档硬约束，确保项目规则能覆盖通用归档资源中的可选确认分支。
- 不修改 OpenSpec 自动生成的 `.opencode`、`.agents`、`.claude`、`.codex` skills 或 commands；项目规则通过配置覆盖通用工作流选择。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无。本次只修正研发流程配置与长期文档，`.openspec.yaml` 使用 `skip_specs: true`。

## Impact

- 受影响路径：`AGENTS.md`、`openspec/config.yaml`、`docs/8-runbooks.md`、本 change 工件。
- 影响后续所有包含 delta spec 的 OpenSpec change 归档行为。
- 不影响产品运行时、构建产物、部署目标、包依赖或生成的 OpenSpec workflow resources。

## Delivery Impact

- 长期文档：需要，更新 `docs/8-runbooks.md` 的归档顺序和 `--skip-specs` 使用边界。
- 入口文档：需要，在根 `AGENTS.md` 增加一句不可跳过的归档硬约束，细则仍由 `docs/8-runbooks.md` 与 `openspec/config.yaml` 维护。
- 版本：无受影响产品包；`NONE` / 不更新任何版本来源 / 只改仓库流程配置与文档，不触及 `packages/**` 或 `go/**`。
- 发布：需要，提交并 push `main` 会触发 docs-app Cloudflare connected build；不打 tag，站点代码与产物逻辑不变，推送后只核对自动构建成功。
- 验收：需要，用 OpenSpec instructions 输出确认 archive guidance 生效，并用静态场景检查确认未同步、已同步、同步失败三条路径的动作唯一。
