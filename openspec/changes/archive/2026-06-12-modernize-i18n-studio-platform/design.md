## Context

i18n-studio 当前的数据模型已经包含 namespace、membership、entry、translation、translation_versions、translation_tasks、task_items、api_tokens、locales。核心路径是：

```
编辑/导入/任务回写
      │
      ▼
translation_versions  ── publish ──▶ translations
      │                              │
      └──────────── bundle_version ◀─┘
                                     │
                                     ▼
                              /snapshot/:slug
```

这个模型足够支持 latest snapshot，但固定 `bundle_version` 语义不可靠：`namespaces.bundle_version` 是全空间发布计数，而 `translation_versions.version` 是单个 `(entry, locale)` 的局部版本。把二者等同会导致固定版本 snapshot 不能准确复现某一次全空间发布。

同时，任务、成员、token、sync 和高危设置已有业务能力，但缺少统一审计、可观测任务流水线、团队邀请生命周期和 CI/生产门禁。现代化应优先补这些系统性缺口，而不是重写 UI 框架或替换数据库。

## Goals / Non-Goals

**Goals:**

- 建立 release/bundle manifest，使 `bundle_version` 可复现、可缓存、可回滚。
- 用统一 audit log 记录所有高价值写操作，并能按 namespace、actor、resource 查询。
- 将翻译任务升级为 item 级、可恢复、可观测的 worker 流水线。
- 为翻译编辑引入质量检查、审阅队列和批量处理工作台。
- 支持 pending invitation，降低团队协作入口摩擦。
- 将 i18n-studio 的 typecheck/test/OpenAPI coverage/Docker build 纳入独立 CI 门禁。
- 修正生产 secret、迁移策略、API 文档和部署文档的契约漂移。

**Non-Goals:**

- 不迁移到外部数据库；SQLite + Drizzle 仍是默认部署形态。
- 不引入实时多人协同编辑、CRDT 或在线光标。
- 不内置具体机器翻译供应商；本变更只定义任务流水线和质量工作台接口。
- 不删除现有 snapshot 路径，也不改变 latest snapshot 的响应结构。
- 不把权限模型扩展为任意 RBAC 权限表达式；仍保留 admin/editor/viewer 三档。

## Decisions

### 1. Release manifest 是 bundle 的唯一复现来源

新增 `releases` 与 `release_items`：

- `releases`: `id`、`namespace_id`、`bundle_version`、`status`、`created_by`、`created_at`、`published_at`、`note`、`source`
- `release_items`: `release_id`、`entry_id`、`locale`、`translation_version_id`、`translation_version_number`、`key`

发布时不再只递增 `namespaces.bundle_version`，而是创建一条 release，并把本次 release 后每个 `(entry, locale)` 对应的 published version 固化为 manifest。`GET /snapshot/:slug?bundle_version=N` 从 manifest 读取，而 latest snapshot 仍可读 `translations` 缓存。

备选方案：继续用 `translation_versions.version <= bundle_version` 推算。放弃原因是两条时间轴含义不同，无法证明正确。

发布序列：

```
用户/任务/同步
    │
    ▼
写入 draft 或 published
    │
    ▼
publish request
    │
    ├─ 更新 translation_versions.status
    ├─ 更新 translations 当前指针
    ├─ namespaces.bundle_version + 1
    ├─ 创建 releases(bundle_version)
    └─ 写入 release_items manifest
             │
             ▼
      snapshot?bundle_version=N
```

### 2. Audit log 使用 append-only 事件表

新增 `audit_events`：

- `id`、`namespace_id`、`actor_id`、`actor_type`、`action`、`resource_type`、`resource_id`
- `request_id`、`before`、`after`、`metadata`、`created_at`

服务层写操作通过轻量 helper 写审计事件。审计失败不应悄悄吞掉；同一事务内的业务写入与审计写入应一起提交。对于 token 明文，只记录 prefix、scope、token id，不记录 plaintext。

备选方案：复用 `translation_versions.metadata`。放弃原因是它只能覆盖翻译版本，无法覆盖成员、token、namespace、任务和 release。

### 3. 任务 item 粒度改为 `(entry, locale)`

当前 task item 只有 entry 维度，但任务目标可以包含多个 locale。现代任务流水线应让每个目标翻译单元独立 claim/write/retry：

- `translation_task_items`: 增加或迁移到 `target_locale`、`attempt_count`、`leased_by`、`lease_expires_at`、`last_error`、`completed_at`
- `translation_task_logs`: 记录 claim、heartbeat、result、retry、fail、complete
- task `done` 表示完成 item 数，`total` 表示 item 总数

worker 交互：

```
worker claim
    │
    ▼
分配 pending/expired items + lease
    │
    ├─ heartbeat 延长 lease
    ├─ results 写入 draft 并完成 item
    ├─ retry 释放 failed/expired item
    └─ complete 当 done == total
```

备选方案：保留 entry 级 item，在 results 里推算 locale 数。放弃原因是进度、失败重试和局部完成都会含糊。

### 4. 质量工作台先做规则引擎，不绑定 AI

质量检查以 deterministic rules 为第一阶段：

- missing translation
- draft pending review
- source changed after target published
- placeholder mismatch，例如 `{name}`、`{{count}}`、`%s`
- ICU/plural 基础解析失败
- HTML tag mismatch
- 长度超出 source 百分比阈值

结果可落库为 `quality_issues`，也可在列表查询时增量计算。第一阶段优先落库，因为它支持队列、过滤、批量关闭和审计。

### 5. 邀请是独立生命周期，不直接创建 membership

新增 `namespace_invitations`：

- `id`、`namespace_id`、`email`、`role`、`token_hash`、`invited_by`
- `status`、`expires_at`、`accepted_by`、`accepted_at`、`revoked_at`、`created_at`

接受邀请时，如果用户不存在，注册后用同一邮箱接受；如果用户已存在，校验 token 后创建 membership。重复邀请同邮箱时更新或撤销旧 pending 邀请。

### 6. CI 门禁分层启用

i18n-studio 的 CI 应分为：

- 必须通过：`pnpm -F i18n-studio typecheck`、`test`、`check:openapi-coverage`
- 发布前通过：Docker build
- 全仓保留：根级 lint/format/build

OpenAPI coverage 从信息性输出改成缺失路径即非零退出。初次落地可先在 PR 上运行并收集误报，然后切换为 required check。

## Risks / Trade-offs

- [release manifest 增加存储量] -> 只记录 published 指针，不复制文案值；文案仍从 `translation_versions` 读取。
- [历史数据没有 release manifest] -> 迁移时为当前 latest 创建初始 release；旧的任意 `bundle_version` 固定查询仅在有 manifest 时保证复现。
- [审计事务扩大写路径复杂度] -> 使用统一 helper 和小型 JSON payload，避免在路由层手写审计。
- [质量规则误报] -> 每条 issue 支持 suppress/resolve，并记录规则版本，规则升级可重新扫描。
- [任务 lease 需要时间语义] -> 使用 server-side `nowMs()`，测试中通过可控时间或短 lease 验证。
- [CI 门禁初期可能暴露大量文档缺口] -> 先修 OpenAPI 和文档契约，再设为 required。

## Migration Plan

1. 新增 release/audit/invitation/quality/task log 表，保持旧 API 行为。
2. 为每个 namespace 创建初始 release manifest，`bundle_version` 使用当前值或从 1 归一化，写入迁移说明。
3. 修改 publish/sync/revert/import/task results 写路径，使发布时创建 release，所有高价值写操作写 audit。
4. 修改 fixed snapshot 查询：有 manifest 时按 manifest 读取；没有 manifest 时返回 404 或明确错误，不再使用错误推算。
5. 迁移任务 item 到 `(entry, locale)` 粒度；保留旧 claim/results 兼容层一段时间。
6. 增加质量扫描服务和 `/dashboard/:slug/quality` 工作台入口。
7. 增加 invitation UI/API，并保留原“按已注册邮箱直接加入”的 admin 快捷路径作为内部实现。
8. 修正文档，启用 CI 门禁。

回滚时保留新增表不读写，snapshot latest 回到 `translations` 表读取，fixed bundle 查询临时下线或只服务已有 manifest。CI 门禁可独立回退，不影响运行时。

## Open Questions

- 初始 release 的 `bundle_version` 是否沿用现有 `namespaces.bundle_version`，还是从 `1` 重新开始并记录 `legacy_bundle_version`？
- fixed snapshot 对没有 manifest 的 legacy `bundle_version` 应返回 404、422，还是 fallback 到旧推算并带 warning？
- 质量检查是否需要第一阶段就支持 ICU parser 依赖，还是先做占位符/HTML/长度的轻量规则？
- invitation 是否需要邮件发送集成，还是第一阶段只生成可复制邀请链接？
