## ADDED Requirements

### Requirement: Item 级翻译任务进度

系统 SHALL 将翻译任务的工作单元建模为 `(entry, target_locale)` item。任务 `total` MUST 等于 item 总数，`done` MUST 等于 completed item 数量。

#### Scenario: 多 locale 任务生成多个 item

- **GIVEN** 任务包含 10 个 entry 和 3 个 target locale
- **WHEN** 系统创建任务
- **THEN** 系统创建 30 个 task item，任务 `total=30` 且 `done=0`

#### Scenario: 单个 locale 回写只完成对应 item

- **GIVEN** 一个 entry 有 `en-us` 与 `ja-jp` 两个 task item
- **WHEN** worker 只回写 `en-us` 结果
- **THEN** 系统只将 `en-us` item 标记为 completed，`ja-jp` item 保持 pending 或 in_progress

#### Scenario: 任务完成条件

- **GIVEN** 任务共有 30 个 item
- **WHEN** 第 30 个 item 完成
- **THEN** 系统将任务状态更新为 completed，并记录 completedAt

### Requirement: Worker lease 与 heartbeat

系统 SHALL 使用 lease 防止任务 item 被永久占用。worker claim item 后 MUST 获得有限时间 lease，并可通过 heartbeat 延长 lease。

#### Scenario: claim 分配 lease

- **GIVEN** 存在 pending task item
- **WHEN** worker 调用 claim
- **THEN** 系统将 item 标记为 in_progress，记录 workerId 和 lease_expires_at

#### Scenario: heartbeat 延长 lease

- **GIVEN** worker 持有未过期 lease
- **WHEN** worker 发送 heartbeat
- **THEN** 系统延长该 worker 持有 item 的 lease，并写入 task log

#### Scenario: 过期 lease 可重新 claim

- **GIVEN** item 的 lease_expires_at 已早于当前时间且未完成
- **WHEN** 另一个 worker 调用 claim
- **THEN** 系统允许重新分配该 item，并增加 attempt_count

### Requirement: 任务日志与失败恢复

系统 SHALL 为任务生命周期写入 task log，覆盖 create、claim、heartbeat、result、retry、fail、cancel、complete。失败 item SHALL 可重试，且 MUST 保留 last_error。

#### Scenario: 回写失败记录 item 错误

- **GIVEN** worker 回写的 locale 不在目标 locale 集合中
- **WHEN** 系统拒绝结果
- **THEN** 系统记录 task log，并保留对应错误原因以供任务详情页展示

#### Scenario: retry 失败 item

- **GIVEN** task item 状态为 failed 且 attempt_count 未超过上限
- **WHEN** admin 或 editor 发起 retry
- **THEN** 系统将 item 重新置为 pending，清理 lease，并写入 retry 日志

#### Scenario: 任务详情展示日志

- **GIVEN** 任务已有 claim、heartbeat、result 和 fail 日志
- **WHEN** 用户打开任务详情页
- **THEN** 页面展示按时间倒序排列的任务事件、worker、item 数和错误摘要
