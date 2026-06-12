## 1. 数据模型与迁移底座

- [x] 1.1 为 release manifest、release item、audit event、quality issue、namespace invitation、task log、task item lease 字段设计 Drizzle schema
- [x] 1.2 生成并检查 SQLite 迁移 SQL，确保新增结构以 additive 方式落地
- [x] 1.3 为现有 namespace 创建初始 release manifest 的迁移或修复脚本
- [x] 1.4 扩展测试 helpers/seed，使集成测试可创建 release、audit、invitation 和 task item 数据

## 2. Release 与 Snapshot 语义

- [x] 2.1 实现 release service：创建 release、写入 manifest、查询 release、按 manifest 读取 bundle
- [x] 2.2 修改 publish/revert/sync/直接 published 写入路径，使客户端可见变更创建 release 并递增 bundle_version
- [x] 2.3 修改 `/snapshot/:slug` 与 `/snapshot/:slug/:locale`，带 `bundle_version` 时只按 release manifest 返回
- [x] 2.4 修改 entries/export 查询，支持 `bundle_version` release 快照语义并处理 legacy `at_version`
- [x] 2.5 为 fixed snapshot、release 回滚、缺失 release、immutable cache header 添加集成测试

## 3. 审计日志

- [x] 3.1 实现 audit service 和统一写入 helper，支持事务内记录 actor/action/resource/before/after/metadata
- [x] 3.2 在 publish、discard、revert、sync、import、task results、namespace update/delete、token create/revoke、member change 写路径接入 audit
- [x] 3.3 新增 audit 查询 API，支持按 namespace、actor、action、resource 和时间范围筛选
- [x] 3.4 在 namespace 设置或独立页面展示 audit 列表与事件详情
- [x] 3.5 添加审计覆盖测试，确保高价值写操作成功时必有 audit event，失败事务不写半截审计

## 4. 翻译任务可观测流水线

- [x] 4.1 将 task item 生成逻辑改为 `(entry, target_locale)` 粒度，修正 total/done 语义
- [x] 4.2 实现 claim lease、heartbeat、lease expiry reclaim、attempt_count 和 last_error
- [x] 4.3 修改 results 写入逻辑，使单个 locale 结果只完成对应 item，并写入 draft
- [x] 4.4 实现 failed item retry、任务 cancel/complete/fail 的日志记录和状态约束
- [x] 4.5 新增任务详情 API 与页面，展示 item 状态分布、worker、lease、日志和错误摘要
- [x] 4.6 添加多 locale 任务、partial result、lease 过期重领、retry、日志展示的集成测试

## 5. 质量工作台

- [x] 5.1 实现质量规则引擎：missing、pending draft、source stale、placeholder mismatch、HTML tag mismatch、长度风险
- [x] 5.2 实现 quality scan service，将问题写入 quality_issues 并支持 resolve/suppress
- [x] 5.3 新增 quality 查询和状态变更 API，按 issue type、locale、prefix、severity、status 筛选
- [x] 5.4 新增 `/dashboard/:slug/quality` 页面和侧栏入口，展示问题队列、筛选器、修复入口和只读 viewer 状态
- [x] 5.5 在词条编辑页标记来自质量工作台的问题 locale，并支持修复后重新扫描
- [x] 5.6 添加质量规则、resolve/suppress、权限和 UI loader/action 测试

## 6. 邀请与团队协作

- [x] 6.1 实现 namespace invitation service：create、resend、revoke、accept、expire validation
- [x] 6.2 修改成员管理 API 和页面，支持邀请未注册 email，并显示 pending/accepted/revoked/expired 状态
- [x] 6.3 新增接受邀请路由；用户未登录时引导登录/注册，登录后按 email 校验并创建 membership
- [x] 6.4 为邀请创建、接受、撤销、成员角色变更和移除接入 audit
- [x] 6.5 添加 invitation 生命周期、重复邀请、过期邀请、接受邀请和权限矩阵测试

## 7. 生产与 CI 门禁

- [x] 7.1 修改 auth/session 初始化：生产环境缺少 `SESSION_SECRET` 或使用默认值时 fail fast
- [x] 7.2 将 `check-openapi-coverage` 改为发现缺失路径时非零退出，并保留清晰输出
- [x] 7.3 更新 GitHub Actions，为 i18n-studio 添加 typecheck、test、OpenAPI coverage 和 Docker build 验证
- [x] 7.4 增加文档契约检查，防止 `/healthz`、未实现 token 过期时间和错误迁移说明回归
- [x] 7.5 添加生产 secret、OpenAPI coverage 和文档契约的单元或脚本测试

## 8. 文档与 OpenAPI

- [x] 8.1 更新 `public/openapi.json`，补充 release、audit、quality、task observability、invitation API
- [x] 8.2 更新 API 文档，移除未实现的 token 过期描述，补充 release snapshot、audit、quality 和 invitation 用法
- [x] 8.3 更新部署文档，去除 `/healthz` 建议，并明确迁移策略与生产 `SESSION_SECRET` 要求
- [x] 8.4 更新 README 的能力列表、环境变量、路径和推荐运维流程
- [x] 8.5 运行 i18n-studio typecheck/test/OpenAPI coverage，记录并修复回归
