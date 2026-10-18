# Tasks

## 1. 建立迁移基线与 Vite+ 根配置

- [ ] 1.1 将既有 `openspec/specs/oxlint-format/spec.md` 规范化为主规格的 Purpose/Requirements 结构且不改变要求语义，运行严格规格校验确认 archive 前置阻塞已消除
- [ ] 1.2 在不修改文件的模式下记录现有 Oxlint/Oxfmt 检查结果以及 i18n Studio 22 文件/208 用例、GPM 2 文件/29 用例、DSH Telegram 10 文件/114 用例的全绿基线，并保存可对比输出；不修改 DSH 业务依赖
- [ ] 1.3 在根 `package.json` 精确固定经确认的 Vite+ 版本并更新 `pnpm-lock.yaml`，运行本地解析的 `vp --version` 与 `vp toolchain` 验证没有依赖全局安装
- [ ] 1.4 创建根级 Vite+ 配置，将现有 Oxlint categories/plugins/ignore 与 Oxfmt 样式/ignore 完整映射，运行 `vp lint` 和 `vp fmt --check` 对比迁移前覆盖范围与结果
- [ ] 1.5 将根 scripts 的 `lint`、`lint:fix`、`format`、`format:write` 改为 Vite+ 入口并新增组合 `check`，逐个运行脚本验证只读和修复模式符合命名语义
- [ ] 1.6 在等价性验证通过后移除根级独立 `oxlint`、`oxfmt` 依赖及不再使用的独立配置文件，重新运行 `vp check` 并确认 Vite+ 配置仍保留全部忽略项与规则

## 2. 迁移 i18n Studio 测试

- [ ] 2.1 将 `i18n-studio` 测试 API 与测试配置 imports 迁到 Vite+ 入口，保留 alias、Node environment、`tests/**/*.test.{ts,tsx}`、setupFiles 和 globalSetup，运行 22 个文件/208 个用例验证配置行为不变且 `tests/seed.ts` 未被收集
- [ ] 2.2 将 `i18n-studio` 的 test/test:watch scripts 改为 Vite+ 命令并移除独立 Vitest 依赖，分别以单次运行和短时 watch 启动验证命令可用
- [ ] 2.3 重点回归 SQLite template/globalSetup、`vi.resetModules` 与测试间环境隔离，运行 `i18n-studio` 全量测试并确认无临时资源泄漏、重复 template 初始化或顺序依赖

## 3. 迁移 Node Test 测试包

- [ ] 3.1 将 GPM 的 2 个测试文件从 `node:test` 基础 `test()` 迁到 `vite-plus/test`，保留 `node:assert/strict`，运行全部 29 个用例验证子进程 cwd、标准输出和退出码断言
- [ ] 3.2 将 GPM test script 改为 Vite+ runner 并显式限定测试 root/include，运行包级命令确认 `.test.ts` 可被稳定发现且无测试外文件误匹配
- [ ] 3.3 将 DSH Telegram 的 10 个测试文件和 test script 迁到 Vite+，保留 `node:assert/strict` 且不改已完成 change 确立的业务依赖字段；运行全部 114 个用例验证 host lifecycle、registration、package contract、异步 runtime、清理和进程退出
- [ ] 3.4 移除 `utils` 中故意失败的无测试占位 script 或将其从测试项目中明确排除，运行根级测试确认无测试 workspace 不制造假失败

## 4. 统一根级测试执行

- [ ] 4.1 在根级 Vite+ 配置中声明 `i18n-studio`、GPM 与 DSH Telegram 的测试 projects，运行测试列表命令确认每个测试文件只属于一个 project
- [ ] 4.2 配置并验证根级 `vp test`，确认 34 个文件/351 个基线用例全部执行、任一失败都会产生非零退出码且单包过滤仍可使用
- [ ] 4.3 搜索现役源码、测试配置和 package scripts，确认 JavaScript/TypeScript 测试不再直接导入 `vitest`/`vitest/config` 或 `node:test` 且不使用 `node --test`，同时确认 Go 测试仍由 `go test` 执行

## 5. 收敛 Git hooks 与 CI

- [ ] 5.1 在 Vite+ 配置中定义 staged JavaScript/TypeScript 格式化与 lint 任务，使用代表性 staged 文件验证只处理暂存范围且不会改写无关未暂存文件
- [ ] 5.2 将 pre-commit 的全目录 Oxlint/Oxfmt 调用替换为 `vp staged`，保留 gitleaks、按需 gofmt 与可选 golangci-lint，执行 hook smoke test 验证各分支仍可触发
- [ ] 5.3 保持 commit-msg 的 commitlint 行为并验证 Vite+ hook dispatcher 继续识别 `.husky` 中的 pre-commit 与 commit-msg hooks
- [ ] 5.4 在 Node.js CI 的依赖安装后加入本地 `vp check` 和 `vp test`，保留原有 `pnpm -r build`、构建环境变量及其他 workflows，并用 workflow lint/本地等价命令验证顺序

## 6. 文档与集成验收

- [ ] 6.1 更新 README、CLAUDE、DSH Telegram README 等现役开发文档中的 Biome、独立 Oxlint/Oxfmt、Vitest 和 Node Test 命令，逐条运行文档展示的 Vite+ 质量与测试命令验证准确性
- [ ] 6.2 运行 `vp check`、根级 `vp test` 及所有现有包级 `typecheck`，确认 Vite+ 未替代 React Router typegen、i18n codegen 或 `tsc`
- [ ] 6.3 运行原有 `pnpm -r build` 并抽查 React Router、Wrangler、Drizzle、ScriptC 和自定义 scripts 未被替换为 `vp dev/build`
- [ ] 6.4 运行 `openspec validate adopt-vite-plus-toolchain --strict`，检查 git diff 仅包含本 change 范围且未修改 DSH 业务依赖版本，记录最终迁移与回滚说明
