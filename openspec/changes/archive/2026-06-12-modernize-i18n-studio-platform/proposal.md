## Why

i18n-studio 已经具备词条 CRUD、草稿发布、历史版本、任务 token、snapshot 和 Docker 部署等基础能力，但它仍更像内部管理后台，而不是可被生产应用依赖的现代本地化平台。当前最需要补齐的是可信发布、审计追踪、翻译质量工作台、可恢复自动化任务和工程门禁，使系统从“能管理文案”升级为“能安全协作并稳定发布文案”。

## What Changes

- 引入 release/bundle 发布模型，确保 `bundle_version` 对应可复现的 immutable snapshot，不再把 namespace 级 bundle version 等同于单条翻译的局部 version。
- 增加统一审计日志，覆盖词条发布/回滚/删除、跨空间同步、翻译任务回写、成员变更、token 创建/撤销、namespace 高危设置等操作。
- 增加翻译质量工作台：缺失、草稿、过期、占位符不匹配、ICU/HTML 风险、长度风险等检查，并支持按问题队列审阅和批量处理。
- 将翻译任务从粗粒度 job 升级为可恢复流水线：按 `(entry, locale)` 跟踪 item，支持 lease、heartbeat、retry、partial failure、任务日志和准确进度。
- 改进团队协作：支持 pending invitation、邀请过期/重发/接受，补齐成员与权限变更的可审计链路。
- 加强生产与工程可信度：生产环境强制配置 `SESSION_SECRET`，迁移策略显式化，OpenAPI 覆盖检查进入 CI 失败门禁，修正文档与实际行为的契约漂移。
- 不引入破坏性 API 删除；已有 snapshot 路径继续保留。固定版本 snapshot 的语义将从“近似按 translation version 过滤”升级为“按 release manifest 复现”。这是行为修正，不是路径级 **BREAKING** 变更。

## Capabilities

### New Capabilities

- `i18n-release-governance`: 定义 release/bundle 发布模型、immutable snapshot、发布审计、回滚与客户端缓存契约。
- `i18n-quality-workbench`: 定义翻译质量检查、审阅队列、批量修复和工作台交互契约。
- `i18n-task-observability`: 定义翻译任务流水线的 item 级状态、worker lease、heartbeat、retry、日志与准确进度。
- `i18n-studio-operational-readiness`: 定义生产安全配置、CI 质量门禁、OpenAPI 覆盖、迁移执行策略和文档契约一致性。

### Modified Capabilities

- `i18n-entry-management`: 修订 snapshot/bundle version 语义，要求固定版本 snapshot 基于 release manifest 而非 per-entry translation version。
- `i18n-namespace-membership`: 增加 pending invitation、邀请接受/过期/重发，以及成员变更审计要求。
- `i18n-studio-deployment`: 修订生产运行契约，明确 secret 校验、迁移执行边界和部署文档不得声明不存在的 `/healthz`。
- `i18n-studio-testing`: 增加 i18n-studio 专属 CI 门禁和 OpenAPI route coverage 失败条件。

## Impact

- 数据模型：新增 release/bundle、audit log、quality issue、task item 状态扩展、invitation、task log/heartbeat 等表或字段。
- 服务层：发布、snapshot、任务、sync、membership、token、namespace 设置等写路径需要统一接入审计与 release 语义。
- API：保留现有路径，扩展 release、quality、task observability、invitation、audit 查询接口；OpenAPI 需同步更新。
- UI：新增质量工作台和审阅队列，增强任务详情页、成员邀请页、发布/回滚体验与发布历史视图。
- 运行与 CI：i18n-studio 需要独立执行 `typecheck`、`test`、`check:openapi-coverage`、Docker build；生产启动时禁止使用默认 session secret。
- 文档：修正 API token 过期时间、任务 token 展示规则、迁移策略和 `/healthz` 等与实际契约不一致的描述。

## Rollback Plan

- 数据迁移应以 additive 方式落地：新增表/字段先与旧发布路径并行，旧 snapshot 路径保持可读。
- 若 release manifest 出现异常，可临时回退到 latest snapshot 读取当前 `translations` 表，并暂停固定 `bundle_version` 查询。
- 审计、质量检查、任务观测能力均可通过 UI 入口和新 API 暂时隐藏，不影响已有词条编辑、发布和 snapshot latest 消费。
- CI 门禁可先以非阻塞 dry-run 合并，确认稳定后切换为阻塞；若误报过多，可单独回退门禁配置而不回退业务代码。
