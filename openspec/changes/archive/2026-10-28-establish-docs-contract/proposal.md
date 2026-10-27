# Proposal

## Why

仓库的长期知识目前按“哪个 agent 工具读它”切分，而不是按用途切分：`CLAUDE.md` 承载安全规则与各应用技术栈，`AGENTS.md` 承载测试哲学与修 bug 流程，两者互不覆盖；命令、CI 门禁、发布通道散落在已过期的 `README.md` 和只有人知道的 workflow 里；交付流程只存在于个别 change 的正文中。结果是 agent 每次都要靠文本猜测“这次要不要改文档、要不要发布、跑哪条命令”，而长期文档没有任何明确的维护者与触发时机。

本次改造把维护者明确为 agent：常驻规则告诉它“改了什么要同步哪里”，OpenSpec 在生成 change 时要求它做出交付评估并落成任务，归档前再由它现场核对。人只负责定方向与 review。

## What Changes

- 重写根 `AGENTS.md`：只保留硬约束、维护触发表、完成定义、开工例程与文档路由，不承载细节。
- `CLAUDE.md` 改为导入 `AGENTS.md`，消除两套约束并存。
- 重写根 `README.md`：仓库定位、包地图、快速开始、文档入口。
- 建立编号化的 `docs/`：`1-architecture.md` … `8-runbooks.md` 加一个不编号的索引 `docs/README.md`；编号是稳定 ID，只追加不重排。仅服务仓库内部，不参与 `docs-app` 构建。
- 新增四个包级 `AGENTS.md`：`packages/apps/vela`（瘦身）、`packages/apps/i18n-studio`、`go/`、`packages/apps/docs-app`，统一包含 `边界` / `验证入口` / `CI 映射` 三节。
- 更新 `openspec/config.yaml`：缩短 `context`，增加 `rules.proposal`、`rules.tasks`，以及 `operations.apply` / `operations.archive` 的核对指引。
- 在交付评估中加入版本维度：`docs/5-release.md` 的 5.2 按包记录版本契约与来源，`rules.tasks` 要求对**每个受影响包**分别判定 `MAJOR / MINOR / PATCH / NONE` 并列出需要更新的文件；不得用一个包的结论代替另一个包。
- 明确文档与规格的边界：行为契约留在 `openspec/specs/`，`docs/` 只写操作知识。

## Non-Goals

- 不引入任何自研校验脚本或新的可执行件；一致性核对由 agent 在归档时用现有命令现场完成。
- 不 fork `spec-driven` schema，不新增第五个 artifact。
- 不把 `docs/` 变成 `docs-app` 的发布内容源，也不搬迁 `packages/apps/vela/docs/`。
- 不给所有 package 建 `AGENTS.md`，只在出现与根不同的约束、独立发布路径或独立验收方式时新增。
- 不改变任何应用的运行时行为、构建产物、部署目标或现有 workflow 的触发条件。

## Capabilities

无新增或修改的 capability。本次是纯文档与工程流程变更，不改变系统可观察行为，`.openspec.yaml` 已设置 `skip_specs: true`。

## Delivery Impact

| 维度 | 结论 | 依据 / 动作 |
| --- | --- | --- |
| 长期文档 `docs/` | 需要 | 建立 `1-architecture` … `8-runbooks` 与索引，见 design |
| 入口文档 | 需要 | 重写 `README.md`、`AGENTS.md`；`CLAUDE.md` 改为导入；新增 4 个包 `AGENTS.md` |
| 版本 | 按受影响包逐项判定：`vela` `NONE`、`i18n-studio` `NONE`、`docs-app` `NONE`、`go/` `NONE` | 四个包本次仅涉及 `AGENTS.md`，不改变交付产物；判定依据 `docs/5-release.md` 的 5.2 |
| 发布 | 不需要 | 不改变运行时与交付产物，不打 tag，不触发任何部署通道 |
| 验收 | 需要 | 盲测 + 各包验证入口实跑 + 归档前现场核对；不涉及真机与线上环境 |

## Impact

- 影响后续所有 OpenSpec change：`proposal` 必须给出交付评估，`tasks` 必须把它落成可执行任务，`apply` 与 `archive` 增加核对动作。
- 版本评估成为交付组必填项，且必须按受影响包逐项进行：即使不发布，也要判定每个包的版本号是否需要变化、要改哪些来源文件，并写明依据。
- 影响 agent 进入仓库后的第一批读取路径：根 `AGENTS.md` 成为唯一入口，包级规则按目录就近加载。
- 不改动 `packages/**` 的应用代码、`go/**`、`.github/workflows/**` 的既有逻辑。
- 工作树中存在进行中的 `add-vela-macos-auto-update`；本次只调整 `packages/apps/vela/AGENTS.md` 的通用段落，不改其 tasks 与实现文件。

## Rollback Plan

- 本次产物全部是文档与配置，回滚即 `git revert`，不影响任何运行时、构建或部署。
- `AGENTS.md` 重写前的内容可从 Git 历史取回；`CLAUDE.md` 的导入式写法可随时还原为完整文件。
- 新增的包 `AGENTS.md` 可直接删除，不影响构建与测试。
- `config.yaml` 的 `rules` 与 `operations` 为附加项，删除后 OpenSpec 回退到默认行为。
- `docs/` 为新增目录，删除后不影响 `docs-app` 与任何应用的构建。
