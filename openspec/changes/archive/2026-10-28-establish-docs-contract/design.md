# Design

## Context

见 `proposal.md` 的 Why。设计只处理一个问题：**让 agent 成为长期文档的维护者，并且让维护动作在它必经的路径上发生，而不是依赖记忆或额外工具。**

当前约束：

- 根 `CLAUDE.md` 与根 `AGENTS.md` 各承载一半约束，按工具切分，任何一方都不完整。
- 事实（命令、CI、发布通道）只存在于已过期的 `README.md` 和 workflow 文件里，没有单一来源。
- `docs/` 不存在；`packages/apps/vela/docs/` 是唯一成熟的长期文档样本。
- 仓库已有 OpenSpec 1.14，支持 `rules.<artifact>` 与 `operations.apply/archive.guidance`，无需 fork schema。
- 用户明确排除自研校验脚本，也排除把 `docs/` 作为 `docs-app` 的发布源。
- 工作树中存在进行中的 `add-vela-macos-auto-update`，本次不得改动其 artifacts 或实现文件。

## Goals / Non-Goals

**Goals:**

- 任意 agent 进入仓库后，只读根 `AGENTS.md` + 目标包 `AGENTS.md`，就能确定边界、命令、CI 通道与文档同步义务。
- 每个 change 在 `proposal` 阶段显式产出交付评估，在 `tasks` 阶段落成可执行动作，在 `archive` 前由 agent 现场核对。
- 长期文档具备稳定编号，可被规则、任务和包文件精确引用。
- 维护责任与触发条件写进常驻文件，不依赖人的记忆。

**Non-Goals:**

- 不设计新的检查器、守护脚本或 CI job。
- 不改变任何应用的运行时、构建产物与部署触发条件。
- 不重新组织 `openspec/specs/`，不把流程写成 capability spec。
- 不把单包细节（如 NSH 平台规则）上移到根文档。

## Decisions

### D1. 约束 / 事实 / 流程三层分离

| 类别 | 载体 | 判断标准 |
| --- | --- | --- |
| 约束 | `AGENTS.md`（根 + 最近的包） | 会改变 agent 的下一个动作 |
| 事实 | `docs/` | 只是“去哪儿找”、路径、命令、矩阵 |
| 流程 | `openspec/config.yaml` 的 `rules` / `operations` | 只在 change 生命周期内成立 |
| 规格 | `openspec/specs/` | 系统可观察行为 |

覆盖关系：根 `AGENTS.md` 的安全与验证底线不可被覆盖；包 `AGENTS.md` 只能覆盖本地选择；`docs/` 不覆盖任何规则，只提供事实。

**替代方案**：继续用 `CLAUDE.md` 作为主文件。**否决原因**：非 Claude agent 读不到，约束覆盖取决于工具，而不是任务。

### D2. 文档编号：章 = 文件，节 = 文件内小节

```
docs/
  README.md              索引（不编号）：编号 -> 文件 -> 维护触发条件
  1-architecture.md      1.1 仓库与包地图  1.2 运行拓扑  1.3 依赖方向
  2-development.md       2.1 工具链  2.2 安装与初始化  2.3 常用命令  2.4 环境变量
  3-testing.md           3.1 测试分层  3.2 该测与不该测  3.3 证据类型
  4-ci-cd.md             4.1 触发路径  4.2 门禁矩阵  4.3 覆盖缺口  4.4 部署目标
  5-release.md           5.1 发布通道矩阵  5.2 版本策略  5.3 tag 与产物  5.4 回滚
  6-security.md          6.1 路径边界  6.2 临时产物  6.3 凭据与外部操作
  7-conventions.md       7.1 TypeScript / Node  7.2 React
  8-runbooks.md          8.1 change 交付  8.2 修 bug
```

编号规则：

1. 编号是永久标识，不复用、不重排。
2. 新内容追加到下一个可用编号；不插队。
3. 拆分文档时新文件取新号，旧号保留为一行指针。
4. 删除内容时保留编号并标注“已废弃 / 并入 x.y”。

**替代方案**：不编号（只靠文件名与标题）。**否决原因**：规则、触发表和 tasks 需要稳定引用；“docs/4-ci-cd.md 的第二节”会随标题改写而失效，`4.2` 不会。

### D3. 维护触发表放在根 `AGENTS.md`

触发表是约束而非事实，必须在 agent 不额外查找的情况下可见。`docs/README.md` 只保留“编号 / 文件 / 内容”的索引与写作约定，不复制触发表；agent 的权威触发点只有根 `AGENTS.md` 一处。

| 改动 | 同步 |
| --- | --- |
| 新增/删除包、workspace 结构 | `README.md` 包地图、`1.1` |
| `package.json` 脚本名 | 该包 `AGENTS.md` 的「验证入口」 |
| `.github/workflows`、部署目标 | `4.1`–`4.4` |
| 版本、tag、发布方式 | `5.1`–`5.3`、包内「发布 / 验收」 |
| 跨包规范 | `7.1`–`7.2` |
| 单包技术栈或例外 | 该包 `AGENTS.md` |
| 测试策略或证据类型 | `3.1`–`3.3` |

**替代方案**：放在 `docs/README.md`。**否决原因**：多一次跳转，而跳转正是当前失败模式的来源。

### D4. 两条维护循环，四个 OpenSpec 评估点

```
                根 AGENTS.md（常驻）
                        |
        +---------------+---------------+
        v                               v
  无 change 的直接修改            OpenSpec change
  按触发表同步 owner 文档         proposal  Delivery Impact
  无关漂移只报告                  tasks     文档动作落成任务
                                  apply     范围变化回写评估
                                  archive   现场核对后归档
```

`proposal` 的 `## Delivery Impact` 固定五行：

| 维度 | 结论形式 |
| --- | --- |
| 长期文档 `docs/` | 需要 + 具体编号 / 不需要 + 理由 |
| 入口文档 `README.md`、包 `AGENTS.md` | 同上 |
| 版本 | 按受影响包逐项：包 / `MAJOR / MINOR / PATCH / NONE` / 需要更新的版本来源文件 / 依据，不得合并成一个全局结论 |
| 发布 | 需要 + 通道与动作 / 不需要 + 依据通道矩阵 |
| 验收 | 需要 + 证据类型与环境 / 不需要 + 理由 |

版本与发布是两个独立判断：即使本次不 tag、不部署，版本号仍可能因交付契约变化而需要更新；反过来，版本不变也可能需要重新部署。

版本行必须逐包展开。受影响包指本次改动触及的路径所属的包，判定只在它们之间进行；未触及的包不写、不判定。示例（`dsh-telegram` 一行是假设场景，不属于本 change）：

| 受影响包 | 判定 | 需要更新的文件 | 依据 |
| --- | --- | --- | --- |
| `packages/apps/vela` | NONE | — | 仅改 `AGENTS.md`，不改变交付产物 |
| `@implementsio/dsh-telegram` | PATCH | `package.json` | 修复了插件文档中的错误说明 |

不同包的版本契约不同（`vela` 有 7 处来源与 build number、`dsh-telegram` 是 npm 包、私有应用不构成契约），所以不能用一个包的结论代表另一个包。

**替代方案 A**：自研 `check-docs-contract` 脚本。**否决原因**：新增长期维护的可执行件，且用户明确排除。
**替代方案 B**：fork schema 增加 `delivery` artifact。**否决原因**：schema 标记为 experimental，升级需手工合并；四个评估点已覆盖同一时刻，先观察漂移再决定。

### D5. 核对用现有命令现场执行

归档前 agent 执行以下动作，不落盘：

1. 对本次文档中引用的路径做存在性确认（`ls` / `test -f`）。
2. 对每个 `pnpm -F <pkg> <script>`，用 `pnpm -F <pkg> run` 对照脚本名。
3. 用 `ls packages/*/*/package.json` 对照 `README.md` 包地图。
4. 重读改过的文档，确认结论仍与代码一致。

**替代方案**：把它们固化成脚本。**否决原因**：动作每次只执行一次，固化后反而需要维护脚本自身与它的边界。

### D6. 包级 `AGENTS.md` 只写四个，统一三节

覆盖范围：`vela`、`i18n-studio`、`go/`、`docs-app`。必需标题：

- `## 边界`：拥有什么、不碰什么、依赖方向。
- `## 验证入口`：表格「变更类型 / 命令 / 期望结果」。
- `## CI 映射`：表格「路径 / workflow-job / 必过门」。

新增条件：某包出现与根不同的约束、独立发布路径或独立验收方式时，才新增文件。`vela` 的现有文件保留平台、验收、版本来源与 iOS CI 边界，通用 SemVer 上移到 `5.2`、通用归档序列上移到 `8.1`。

**替代方案**：所有包都建。**否决原因**：样板文件只重复根规则，增加 token 与第二处漂移源。

### D7. `CLAUDE.md` 只做导入

根 `CLAUDE.md` 内容：

```markdown
@AGENTS.md

在 `packages/**` 或 `go/**` 下工作时，先读该目录最近的 `AGENTS.md`。
```

不为每个包额外创建 `CLAUDE.md` stub；依赖根文件的显式指引。**替代方案**：包级 stub。**否决原因**：多四个文件，收益仅是省一次读取指令。

### D8. `openspec/config.yaml` 的具体形状

```yaml
schema: spec-driven

context: |
  语言：简体中文（所有产出物）。
  仓库：pnpm workspace（packages/**）+ 独立 Go module（go/）+ macOS/iOS 打包应用（vela）。
  长期知识：docs/ 是事实来源；包级约束在最近的 AGENTS.md。
  交付评估：proposal 给结论，tasks 落动作，archive 前现场核对。

rules:
  proposal:
    - 必须包含 ## Delivery Impact 五行：长期文档 / 入口文档 / 版本 / 发布 / 验收
    - 每一项给出“需要 + 文件/动作”或“不需要 + 理由”，不得省略
    - 版本项按受影响包逐项给出：包 / MAJOR、MINOR、PATCH 或 NONE / 需要更新的版本来源文件 / 依据；不得合并成一个全局结论
    - 显式列出受影响包与路径
  specs:
    - 场景使用 Given/When/Then；只描述可观察行为
  design:
    - 复杂流程给时序图；写明失败路径与回滚
  tasks:
    - 先读受影响包 AGENTS.md 的「验证入口 / CI 映射」与 docs/4-ci-cd.md
    - 每个任务写出可执行验证（命令、workflow/job 或可观察结果），禁止“运行测试”“确认无回归”
    - 每个任务组自带测试与文档；跨组集成、CI、发布、验收只放最后一组
    - 交付组必须对 Delivery Impact 中列出的每个受影响包分别做版本评估：按 docs/5-release.md 的 5.2 判定 MAJOR / MINOR / PATCH / NONE，列出该包需要更新的版本来源文件；NONE 也要写理由，不得用一个包的结论代表另一个包
    - 版本评估独立于发布评估：不 tag、不部署不代表版本号不变，反之亦然
    - 最后一组按 docs/4-ci-cd.md 与 docs/5-release.md 裁剪，显式覆盖专项命令、路径过滤或新增 gate、版本动作、验收证据
    - 矩阵中没有对应门禁时，新增或写“缺口 + 原因”
    - 归档后的动作放 ## Workflow follow-up

operations:
  apply:
    guidance:
      - 若实现改变脚本名、workflow、部署路径、跨包契约或交付产物，回到 Delivery Impact 重新评估并更新 tasks
      - 若实现范围扩大到触及新的包或改变交付产物，对该包补做版本评估并更新 tasks
      - 勾选任务前确认它引用的命令刚刚真实执行过
  archive:
    guidance:
      - 复核 Delivery Impact 每条结论仍成立，包括每个受影响包的版本判定
      - 对本次改过的文档逐条核对：路径存在、脚本名存在、包地图与实际目录一致
      - 无关漂移只报告，不擅自扩大范围
```

## Risks / Trade-offs

- **规则被敷衍** → `archive` 指引要求逐条复核；先观察 3 个 change，再决定是否 fork 硬闸门。
- **版本评估被当成发布评估** → `rules.tasks` 明确两者独立；`5.2` 按包列出版本来源，判定 `NONE` 也必须写理由。
- **用一个包的结论代表另一个包** → 版本项按受影响包逐项展开；未触及的包不判定，触及的包不得省略。
- **编号导致重排冲动** → 只追加编号，删除保留占位；`docs/README.md` 索引同步一行。
- **文档仍会漂移** → 接受无自动校验；把最高频失效的两类事实（命令、workflow）放在执行路径上，用的时候自然暴露。
- **根 `AGENTS.md` 变长** → 目标不超过 60 行；细节一律外置到编号文档。
- **`@AGENTS.md` 导入在旧版 Claude Code 不生效** → 记录版本前提；不支持时回退为完整文件，语义不变。
- **与进行中的 vela change 冲突** → 只改 `packages/apps/vela/AGENTS.md` 的通用段落，不动 `tasks.md` 与实现文件。

## Migration Plan

1. 事实层：建立 `docs/` 编号文件与索引，先写清现有 CI 矩阵、发布通道、测试入口与缺口。
2. 约束层：重写根 `AGENTS.md`，`CLAUDE.md` 改为导入，新增四个包 `AGENTS.md`，瘦身 `vela/AGENTS.md`。
3. 入口层：重写根 `README.md` 包地图。
4. 流程层：更新 `openspec/config.yaml` 的 `context` / `rules` / `operations`。
5. 验证：盲测、各包验证入口实跑、归档前按 D5 核对。

回滚：全部为文档与配置，`git revert` 即可；删除 `docs/` 与新增包文件不影响任何构建。

## Open Questions

无。`docs/` 是否纳入现有 `vp check` 路径范围属于实现细节，不影响分层、编号或规则设计，留到 apply 时按最小改动决定。
