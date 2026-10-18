# Design

## Context

参见 `proposal.md` 的动机。仓库是 pnpm monorepo，根目录直接维护 Oxlint/Oxfmt，`i18n-studio` 使用 Vitest 2，GPM 与 DSH Telegram 使用基础 `node:test`。实施时确认基线为 34 个 JavaScript/TypeScript 测试文件、352 个用例：i18n Studio 22/208、GPM 2/29、DSH Telegram 10/115，三组均已全量通过。多个应用还各自使用 Vite 5/6、React Router、Wrangler、Storybook 和代码生成流程。

本机全局 `vp` 为 1.3.0，但项目尚未声明本地 Vite+；可复现执行不能依赖这份全局安装。现有测试只使用 Vitest 常规 API或 `node:test` 的基础 `test()`，未使用 Node Test 专属 mock、hook、并发和 reporter API，因此 runner 统一无需重构测试业务逻辑。

DSH Telegram 升级 change 已完成并增加了 host lifecycle、registration 与 package contract 等测试；新增测试仍只依赖基础 `test()` 和 `node:assert/strict`，没有引入 Node Test 专属 mock、context、hook、plan 或 reporter API。本设计只允许修改该包的测试 import/script，不重新解释或修改其业务依赖和行为决策。

既有主规格 `openspec/specs/oxlint-format/spec.md` 仍使用只适用于 change delta 的 `## ADDED Requirements` 结构，OpenSpec 无法把其中要求解析为合法主规格。该历史结构不影响本 change 的规划校验，但会阻止 delta 在 archive 时合并，因此实施前必须先做不改变语义的结构规范化。

## Goals / Non-Goals

**Goals:**

- 用一个根级 Vite+ 配置承载 lint、format、test project 和 staged-check 治理。
- 让测试 API、类型、配置和 runner 均来自仓库固定的同一 Vite+ 版本。
- 让根级 `vp check` 与 `vp test` 成为本地和 CI 的稳定验证入口。
- 保持现有格式、lint 范围、测试隔离和完整类型检查语义。

**Non-Goals:**

- 不把 React Router、Wrangler、Drizzle、ScriptC 或自定义命令改写为 `vp dev/build`。
- 不在本变更中升级应用 Vite、Storybook、React Router 或 DSH 业务依赖。
- 不用 Vite+ 实验性类型诊断取代 `tsc`、React Router typegen 或 i18n codegen。
- 不统一 `go test`、gitleaks、commitlint 等非目标工具，也不重写测试断言风格。

## Decisions

### 0. 先规范化旧主规格，再修改其要求

在工具代码迁移前，将 `oxlint-format` 主规格整理为标准 `## Purpose` 与 `## Requirements` 结构，逐项保留现有 requirement 和 scenario 的语义。规范化后先对该主规格执行严格校验，再实施本 change 的 `MODIFIED Requirements`。

不选择绕过旧 capability、另建近义规格的方案，因为这会留下相互冲突的 Oxlint 工具要求；也不在 proposal 阶段直接修改主规格，因为该动作属于 apply 范围而非 change 规划产物。

### 1. 使用根级 Vite+ 控制面，不批量改写应用 Vite 配置

在 workspace 根声明精确版本的 `vite-plus`，并创建根级 Vite+ 配置管理 `lint`、`fmt`、`test`、`staged` 等横切工具。各应用现有 `vite.config.ts` 继续由 React Router、Cloudflare、PWA 或 Storybook 构建流程使用。

不直接接受 `vp migrate --no-interactive` 对整个 monorepo 的全部改写；实施时可借助 migrator 识别建议，但最终只保留本 change 明确覆盖的工具变更。这样避免迁移器将工具治理与 Vite 5/6 到 Vite 8、Storybook 升级耦合。

备选方案是一次性让 Vite+ 接管 dev/build/test。该方案会触发 `react-component` 的 Storybook 8 peer 冲突，并改变用户明确要求保留的框架命令，因此不采用。

### 2. 将现有 Oxlint/Oxfmt 语义合并到 Vite+ 配置

将 `oxlint.json` 的 categories、plugins、ignore 和 `.oxfmtrc.json` 的格式规则、ignorePatterns 映射到根级 Vite+ 配置。迁移前后分别运行只读检查并比较文件集合与诊断，确认没有静默缩小覆盖范围。

根 scripts 保留易发现的 `lint`、`lint:fix`、`format`、`format:write` 名称，但实现改为 `vp`；同时新增或确认 `check` 作为组合只读检查入口。迁移稳定后移除根级独立 `oxlint`、`oxfmt` 依赖和不再使用的独立配置文件，防止双重配置漂移。

备选方案是保留独立配置并仅让 `vp` 透传。该方案仍需独立维护工具版本和配置，不能实现工具链统一，因此不采用。

### 3. 所有受管 JavaScript/TypeScript 测试统一到 Vite+ 内置 Vitest

`i18n-studio` 将 Vitest API import 改为 `vite-plus/test`，配置改用 Vite+ 配置入口，并保留 alias、Node environment、include、setupFiles 与 globalSetup。GPM 和 DSH Telegram 将基础 `node:test` import 改为 Vite+ `test`，继续使用 `node:assert/strict`。

根级配置声明包级测试 projects，使 `vp test` 可从仓库根执行全部 34 个 JavaScript/TypeScript 测试文件，同时每个包仍可单独运行。测试目录、临时数据库初始化、子进程 cwd 等路径必须继续以各包为边界解析；Go 测试继续由 `go test` 执行。

```text
+-------------------+
|     vp test       |
+---------+---------+
          |
          v
+-------------------+
| root test projects|
+----+---------+----+
     |         |
     v         v
+----------+  +----------+  +----------------+
| i18n     |  | gpm      |  | dsh-telegram   |
| setup +  |  | CLI      |  | runtime/plugin |
| sqlite   |  | process  |  | tests          |
+----------+  +----------+  +----------------+
     |             |               |
     +-------------+---------------+
                   |
                   v
        +----------------------+
        | Vite+ bundled Vitest |
        +----------------------+
```

备选方案一是仅用 `vp run` 调度原有 runner；这只统一外壳，不统一测试 API、类型或版本。备选方案二是保留独立 Vitest 依赖并由 `vp test` 启动；这可能让源码类型和实际 runner 来自不同版本。两者均不采用。

### 4. 完整类型检查继续由包级脚本定义

Vite+ 的 `check` 默认只承担格式与 lint；不启用其实验性 type-check 作为验收依据。需要完整类型检查时，继续运行现有包级 `typecheck`，其中 React Router 和 i18n 的生成步骤保持在 `tsc` 之前。

这避免把“统一工具入口”误解为删除领域所需的类型生成。未来若要评估 Vite+ 类型诊断，应另建 change 并对比 `tsc` 诊断覆盖率。

### 5. Git hooks 只收敛 JavaScript/TypeScript 检查

使用 Vite+ staged 配置只处理本次提交涉及的受管文件，避免当前 pre-commit 对整个 `packages` 目录执行写入。项目 hook 从 `.husky/` 迁到 `.vite-hooks/`，根 `prepare` 改为 `vp config --hooks-dir .vite-hooks --no-agent`，并移除 Husky 依赖。现有 gitleaks 和按需 Go 检查继续由 hook 串联，commit-msg 继续运行 commitlint。

```text
git commit
    |
    v
+------------------+
| pre-commit       |
+------------------+
    |-- vp staged --------> JS/TS lint + format
    |-- gitleaks ---------> staged secret scan
    +-- Go changed? ------> gofmt + optional golangci-lint

commit-msg ----------------> commitlint
```

### 6. 同步 i18n Studio 测试契约

现有 `i18n-studio-testing` 主规格明确约束独立 `vitest.config.ts`、Vitest globalSetup 和 include 行为。迁移时同步修改该 capability，将工具归属改为 Vite+ 内置 Vitest，但保持测试目录、`tests/**/*.test.{ts,tsx}`、template DB、seed 排除和 `pnpm -F i18n-studio test` 的可观察行为。

备选方案是只修改通用工具规格、不更新应用测试规格；这会让 durable specs 同时要求独立 Vitest 与 Vite+ 内置 Vitest，因此不采用。

### 7. CI 使用本地 Vite+，不依赖全局环境

CI 仍通过 pnpm 安装依赖，随后运行本地解析的 `vp check` 和 `vp test`，再执行原有递归构建。框架构建、环境变量和 Go workflow 不因本变更改变。

## Risks / Trade-offs

- [历史 `oxlint-format` 主规格结构会阻止 archive] -> 将语义不变的主规格规范化作为 apply 首个任务，严格校验通过后才修改工具实现。
- [Vitest 2 到内置 Vitest 5 存在隔离或默认值变化] -> 保留现有测试配置，先逐包验证，再运行根级全量测试，重点检查 `vi.resetModules`、globalSetup 和 SQLite 临时目录。
- [`node:test` 与 Vitest 的测试发现和退出行为不同] -> 显式配置 include/root，并验证 GPM 子进程退出码与 DSH 异步资源都能正常收敛。
- [Oxfmt 0.46 到 Vite+ 内置 0.73 可能产生格式差异] -> 先执行 check/list-different 审核差异，再单独提交可接受的机械格式化，避免混入语义修改。
- [根级 Vite+ 配置与包级应用 Vite 配置混淆] -> 根配置只承载横切工具；不修改应用 dev/build 命令，并通过包级测试 project 明确 root。
- [DSH 升级产物仍是当前工作区改动，可能与测试迁移触及同一文件] -> 本 change 仅改测试字段/import，实施时保留已完成 change 的所有业务依赖和行为改动，不覆盖其决策。
- [全局 `vp` 掩盖本地依赖缺失] -> CI 与验收查询 toolchain，并确认执行解析到仓库固定版本。

## Migration Plan

1. 规范化并严格校验既有 `oxlint-format` 主规格，不改变其要求语义。
2. 记录现有 Oxlint/Oxfmt 文件集合、诊断和 34 文件/352 用例的测试基线；不在本 change 中修改 DSH 业务依赖。
3. 在根目录精确固定 Vite+，建立仅覆盖横切工具的根配置，并迁移 lint/format 规则。
4. 对比迁移前后 `vp lint`、`vp fmt --check` 与既有命令的覆盖范围和结果，再移除独立 Oxlint/Oxfmt 入口。
5. 先迁移 `i18n-studio` 到 Vite+ 测试 API/config 并验证 208 个用例，再迁移 GPM 的 29 个用例和 DSH Telegram 的 115 个用例。
6. 配置根级测试 projects，验证一次性与 watch/单包执行；清理独立 Vitest 和故意失败的无测试占位脚本。
7. 将项目 hooks 从 Husky 迁到 Vite+ dispatcher，收敛到 staged 文件并保留附加检查；将 Node CI 增加 `vp check`、`vp test` 后继续原有构建。
8. 更新 README、CLAUDE 等现役开发文档，运行完整质量、测试、类型检查和构建验收。

回滚时按相反顺序恢复 scripts、imports、独立测试与质量工具依赖和配置。由于应用 dev/build/deploy 与完整类型检查实现从未替换，回滚不涉及应用架构或部署流程。
