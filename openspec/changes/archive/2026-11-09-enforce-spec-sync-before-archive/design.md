# Design

## Context

项目已将 change 生命周期规则归于 `openspec/config.yaml`，将操作说明归于 `docs/8-runbooks.md`。通用 OpenSpec 归档资源支持 `Archive without syncing` 和重复确认，这是跨项目默认能力；项目当前没有 archive guidance 覆盖该选择，因此 agent 可能把本项目的确定流程重新变成用户选择。

## Goals / Non-Goals

**Goals:**

- 用项目权威配置定义唯一的带 delta 归档路径。
- 让人和 agent 可从流程手册读到相同顺序与失败处理。
- 保留通用 OpenSpec 资源可更新性，不维护多份派生 skill 补丁。

**Non-Goals:**

- 不修改 `.opencode`、`.agents`、`.claude`、`.codex` 中生成的归档资源。
- 不移除 OpenSpec CLI 的 `--skip-specs` 参数。
- 不为流程规则新增脚本、测试框架或 CI job。

## Decisions

### D1. 根 `AGENTS.md` 提供硬约束，`openspec/config.yaml` 提供生命周期细节

通用归档资源明确把 `operations.archive.guidance` 视为 advisory，不能靠它取消通用确认分支。因此根 `AGENTS.md` 必须写入一句项目硬约束：有 delta 时先同步并校验，失败停止，不得跳过；完成态不重复确认。`operations.archive.guidance` 展开生命周期动作，`docs/8-runbooks.md` 解释操作顺序。

备选方案是直接修改四套生成的 skills/commands。该做法会制造多个事实源，并在下一次 OpenSpec resource refresh 时被覆盖，因此不采用。

### D2. 带 delta 的归档采用确定状态机

```text
开始归档
  |
  +-- 没有 delta --------------------------> 归档
  |
  +-- delta 已同步 -- 主规格校验通过 ------> 归档
  |                         |
  |                         +-- 失败 -------> 停止
  |
  +-- delta 未同步 --------> 同步主规格
                              |
                              +-- 同步成功 -> 校验全部主规格 -> 归档
                              |
                              +-- 阻塞/失败 -----------------> 停止
```

状态已经决定下一动作时，不询问“是否同步”或“是否归档”。只有 change 名称不明确、artifacts/tasks 未完成，或同步出现无法安全解决的冲突时，才需要用户输入。

### D3. `--skip-specs` 不作为失败绕过

`--skip-specs` 只适用于声明 `skip_specs: true` 且没有 delta spec 的纯流程、工具或文档 change。只要 `artifactPaths.specs.existingOutputPaths` 非空，就必须完成同步与校验，不能因同步失败改走跳过路径。

## Risks / Trade-offs

- [通用 skill 仍显示可跳过选项] → archive guidance 明确项目策略优先级；验收直接检查 `openspec instructions archive` 的输出包含确定规则。
- [规则只靠自然语言执行] → 同时写入配置与 runbook，并使用三条状态场景检查动作唯一；项目已明确不新增自研检查器。
- [纯流程 change 被误要求同步] → 以 `existingOutputPaths` 是否为空判定，而不是只看是否存在 specs artifact。

## Migration Plan

1. 更新根 `AGENTS.md` 的归档硬约束。
2. 更新 `openspec/config.yaml` 的 archive guidance。
3. 更新 `docs/8-runbooks.md` 的归档步骤与 `--skip-specs` 边界。
4. 运行 OpenSpec instructions、strict validation 与静态场景核对。
5. 该 change 没有 delta spec，完成后直接归档。

回滚时恢复上述三个文件并移除或反向归档本 change；不影响产品运行时与已归档的业务规格。
