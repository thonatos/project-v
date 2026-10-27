# Tasks

## 1. 事实层：建立编号化的 docs/

- [x] 1.1 创建 `docs/1-architecture.md`，写 1.1 仓库与包地图、1.2 运行拓扑、1.3 依赖方向（含 vela 的 `macos/ios -> shared/core` 禁止反向、`go/` 的 `cmd + internal` 布局）；验证：与 `ls packages/*/*/package.json`、`ls go/cmd go/internal` 逐项对照，无遗漏或虚构目录。
- [x] 1.2 创建 `docs/2-development.md`，写 2.1 工具链、2.2 安装与初始化、2.3 常用命令、2.4 环境变量；验证：版本声明与 `package.json`、`go/go.mod`、`packages/apps/vela/docs/development.md` 对照，并显式记录 `go/go.mod` 的 `go 1.26`、CI 的 Go 1.26 与 Vela 文档 1.27.2 之间的差异来源。
- [x] 1.3 创建 `docs/3-testing.md`，写 3.1 测试分层、3.2 该测与不该测、3.3 证据类型；验证：3.1 的测试项目与根 `vite.config.ts` 的 `test.projects`（i18n-studio、gpm、dsh-telegram）及 `packages/apps/vela/package.json` 的 `test*` 脚本逐项对照。
- [x] 1.4 创建 `docs/4-ci-cd.md`，写 4.1 触发路径、4.2 门禁矩阵、4.3 覆盖缺口、4.4 部署目标；验证：矩阵中的每个 workflow 路径都能在 `.github/workflows/` 找到，4.3 列出的每个“无 gate”目标（docs-app、remix-api、remix-flow、i18n-studio）在 `ls .github/workflows` 中确实没有对应文件。
- [x] 1.5 创建 `docs/5-release.md`，写 5.1 发布通道矩阵、5.2 版本策略、5.3 tag 与产物、5.4 回滚；其中 5.2 必须按包逐行覆盖 `packages/` 下每个包、`go/` 与 `vela`，列「是否构成版本契约 / 版本来源文件 / 判定粒度 / 升级触发」，并写清 `vela` 的 7 处来源与 Apple build number、`@implementsio/dsh-telegram` 的 npm 版本；验证：5.2 覆盖 `ls packages/*/*/package.json` 的每个包再加 `go/`，每个标注的版本来源文件都能 `test -f` 通过。
- [x] 1.6 创建 `docs/6-security.md`，写 6.1 路径边界、6.2 临时产物、6.3 凭据与外部操作，只写理由与边界案例，不重复根 `AGENTS.md` 的规则条目；验证：与 `AGENTS.md` 当前规则逐条对照，确认没有新增或改变规则语义。
- [x] 1.7 创建 `docs/7-conventions.md`，写 7.1 TypeScript / Node、7.2 React；验证：与现有 `CLAUDE.md` 的 TS/React 条目逐条对照，条目数不减少。
- [x] 1.8 创建 `docs/8-runbooks.md`，写 8.1 change 交付、8.2 修 bug；验证：8.1 以 `add-vela-macos-auto-update/tasks.md` 的 Workflow follow-up 为样本泛化，8.2 与当前 `AGENTS.md` 的修 bug 六步逐条对照。
- [x] 1.9 创建 `docs/README.md`：编号索引（编号 / 文件 / 内容）、写作约定（指针不复制、命令只写 script 名、workflow 只写路径、包清单只出现一次）、边界声明（仅服务仓库内部，不参与 `docs-app` 构建）；验证：索引中的 8 个文件全部存在，且 `docs/README.md` 未复制根 `AGENTS.md` 的维护触发表。

## 2. 约束层：重写 AGENTS 与新增包级契约

- [x] 2.1 重写根 `AGENTS.md`：开工例程、硬约束、完成定义（含对每个受影响包的版本结论）、维护触发表、文档路由、包级规则，目标不超过 60 行；验证：`wc -l AGENTS.md` 不超过 60，且六条硬约束、五条完成定义（其中一条要求逐包给出 `MAJOR/MINOR/PATCH/NONE` 结论）、七行触发表与四个包入口全部存在。
- [x] 2.2 将 `CLAUDE.md` 改为 `@AGENTS.md` 导入并保留一行“先读最近的包 AGENTS.md”提示；验证：`wc -l CLAUDE.md` 不超过 5，且首行导入指向存在的文件。
- [x] 2.3 瘦身 `packages/apps/vela/AGENTS.md`：通用 SemVer 移入 `docs/5-release.md` 的 5.2、通用归档序列移入 8.1；保留 NSH 规范、设计规范、编码与状态、测试规则、版本来源清单、验证入口、iOS CI 边界；验证：逐条比对旧文件，确认所有 Vela 专属规则仍在，且 `pnpm -F vela run` 中存在「验证入口」引用的全部脚本。
- [x] 2.4 创建 `packages/apps/i18n-studio/AGENTS.md`，包含 `边界`、`验证入口`、`CI 映射` 三节，写清 RR7 + SQLite + Drizzle、不引入外部状态库、Radix 例外、loaders/actions、`data/i18n.db` 与 `.gitignore`、部署方式；验证：`pnpm -F i18n-studio run` 列出「验证入口」引用的每个脚本。
- [x] 2.5 创建 `go/AGENTS.md`，包含 `边界`、`验证入口`、`CI 映射` 三节，写清 module 路径、`cmd + internal` 布局、echo 与手动 DI、`html/template` + `go:embed`、Bot API、环境变量配置与 7001、gofmt/vet/build/test、golangci-lint v2 配置、Docker 与镜像 workflow，并声明 TS/React 规范不适用；验证：`cd go && go build ./... && go vet ./...` 通过。
- [x] 2.6 创建 `packages/apps/docs-app/AGENTS.md`，包含 `边界`、`验证入口`、`CI 映射` 三节，写清 `app/docs/` 内容模型、不存放工程文档、SSG 构建、wrangler 手动部署、无部署 gate；验证：`pnpm -F docs-app typecheck` 通过，且 `grep -n "docsDir" packages/apps/docs-app/app/lib/docs.ts` 仍指向 `app/docs`。
- [x] 2.7 校验四个包 `AGENTS.md` 的标题一致性与引用有效性；验证：四个文件均各含一次 `## 边界`、`## 验证入口`、`## CI 映射`，且其中引用的 `docs/` 编号均存在于刚创建的文档中。

## 3. 入口层：重写 README 包地图

- [x] 3.1 重写 `README.md`：仓库定位、包地图（包名 / 用途 / 运行 / 部署 / 文档入口）、快速开始、`docs/README.md` 链接；验证：包地图行数等于 `ls -d packages/*/* | wc -l` 再加 `go/` 一行。
- [x] 3.2 删除脚手架与过期内容（React Router 模板段落、只覆盖两个 wrangler 应用的 Deploy 段），改为指向 `docs/5-release.md` 的 5.1；验证：`grep -n "Welcome to React Router" README.md` 无结果，且 README 中每个部署命令都能在对应包 `package.json` 找到。

## 4. 流程层：把交付评估写进 OpenSpec

- [x] 4.1 更新 `openspec/config.yaml` 的 `context` 为短指针（语言、仓库结构、docs 与包 AGENTS 的定位、交付评估四步），保留 `rules.specs` 与 `rules.design`；验证：`openspec instructions proposal --change establish-docs-contract --json` 返回的 `context` 为新内容且不含完整 CI 矩阵。
- [x] 4.2 增加 `rules.proposal`（Delivery Impact 五行 + 受影响包）与 `rules.tasks`（可执行验证、每组自带测试与文档、交付组裁剪、缺口声明、Workflow follow-up），并在 `rules.tasks` 中写明版本评估：对 Delivery Impact 中每个受影响包分别按 5.2 判定 `MAJOR / MINOR / PATCH / NONE`、列出该包需要更新的版本来源文件、`NONE` 必须写理由，不得用一个包的结论代表另一个包，且版本评估独立于发布评估；验证：`openspec instructions proposal|tasks --change establish-docs-contract --json` 的 `rules` 字段包含以上全部条目。
- [x] 4.3 增加 `operations.apply.guidance` 与 `operations.archive.guidance`（范围变化回写、触及新包时补做该包版本评估、勾选前实跑、归档前逐条核对、无关漂移只报告）；验证：`openspec instructions apply --change establish-docs-contract --json` 返回 `operationGuidance` 且内容为新条目。
- [x] 4.4 用新规则反向检查本 change：`proposal.md` 已含 `## Delivery Impact` 五行（版本项已逐包列出且均为 `NONE`），`tasks.md` 每条都有可执行验证；验证：`openspec validate establish-docs-contract --strict` 通过，且逐条走查本文件没有任何“运行测试”“确认无回归”这类无验收任务。

## 5. 集成与验收

- [x] 5.1 盲测：让一个未参与本次改造的 agent 只读根 `AGENTS.md` + 任一包 `AGENTS.md`，回答四个问题（能否读 `~/x`、本次该跑哪条命令、CI 走哪个 job、本次触及的包中哪些需要升版本及理由）；验证：四个答案均正确，错误项回到对应文件修正后重测。
- [x] 5.2 实跑文档引用的命令：`pnpm -F docs-app build`、`pnpm -F i18n-studio typecheck`、`cd go && go build ./...`，并对 Vela 用 `pnpm -F vela run` 核对「验证入口」的脚本名；验证：前三条命令成功退出，Vela 的每个脚本名都能在输出中找到。
- [x] 5.3 一致性核对：`ls packages/*/*` 与 README 包地图一致，`docs/README.md` 索引的 8 个文件都存在，根 `AGENTS.md` 与包文件引用的 `docs/` 编号都存在，`packages/apps/docs-app/app/lib/docs.ts` 仍只读取 `app/docs`；验证：以上四组对照均无差异。
- [x] 5.4 复核 Delivery Impact 五行是否仍成立：长期文档与入口文档为“需要且已完成”；版本项逐包为 `NONE`（`vela`、`i18n-studio`、`docs-app`、`go/`）且未修改任何版本来源文件；发布为“不需要且未触发”；验收为“需要且有证据”；验证：`git status --short` 中属于本次 change 的路径只有 `AGENTS.md`、`CLAUDE.md`、`README.md`、`docs/`、`openspec/`、四个包 `AGENTS.md` 与两个包 README，且不含任何版本来源文件；`git tag --list` 仍为 `vela-v0.1.0`、`vela-v0.2.0`。工作树中同时存在进行中的 `add-vela-macos-auto-update` 未提交文件，不纳入本次判定。
- [x] 5.5 运行仓库既有门禁，确认改造没有破坏构建或测试；验证：`pnpm check` 与 `pnpm test` 通过。

## Workflow follow-up

- 评审通过后归档 change：`openspec archive establish-docs-contract`。
- 提交并推送，等待 `nodejs-ci` 通过；本次不修改 workflow 触发条件。
- 本次不创建 tag、不部署任何应用；发布结论为“不需要”，依据 `docs/5-release.md` 的 5.1。
- 下一个真实 change 作为观察样本：确认 `proposal` 的 Delivery Impact 与 `tasks` 的交付动作是否被实际执行，再决定是否需要更硬的闸门。
