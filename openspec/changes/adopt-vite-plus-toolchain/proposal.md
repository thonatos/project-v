# Proposal

## Why

仓库当前分别维护 Oxlint、Oxfmt、独立 Vitest 与 `node:test` 的依赖、命令和执行方式，34 个 JavaScript/TypeScript 测试文件、351 个现有用例分散在三套执行入口中。Vite+ 已在本机可用，适合统一代码质量与全部 JavaScript/TypeScript 测试工具，同时保留 React Router、Wrangler、Go 测试和各类业务生成命令的现有职责。

## What Changes

- 将 Vite+ 作为仓库本地固定版本的通用开发工具链，并通过 `vp` 提供 lint、format、check 和 test 入口。
- 将现有 Oxlint/Oxfmt 配置语义迁入 Vite+ 可识别的统一配置，保持现有扫描范围、忽略路径和格式规则。
- 将 `i18n-studio` 的独立 Vitest 2 测试以及 GPM、DSH Telegram 的全部基础 `node:test` 测试统一迁移到 Vite+ 内置 Vitest；测试可继续使用 `node:assert/strict`，不要求重写断言风格。
- 将测试源码和配置从直接依赖 `vitest`/`vitest/config` 调整为 Vite+ 提供的稳定入口，确保 API、类型与 runner 版本一致。
- 让 CI 和 Git hooks 使用统一质量检查入口；staged 检查不得移除现有 gitleaks、commitlint 与 Go 专用检查。
- 保留现有 `tsc`、React Router typegen 和 i18n codegen 类型检查链，不以 Vite+ 的实验性类型检查替代完整类型检查。
- 不替换 React Router、Wrangler、Drizzle、ScriptC、自定义构建/发布、`go test` 等领域命令，也不以本次变更升级应用 Vite、Storybook 或修改 DSH 业务依赖版本。

## Capabilities

### New Capabilities

- `vite-plus-toolchain`: 定义仓库通过 Vite+ 统一执行代码质量检查和测试，同时保留框架命令、完整类型检查及非 JavaScript 检查边界的行为。

### Modified Capabilities

- `oxlint-format`: 将直接调用独立 Oxlint/Oxfmt 的要求调整为由 Vite+ 统一提供 lint、format 和自动修复入口，并保持既有规则与忽略范围。
- `i18n-studio-testing`: 将独立 Vitest 配置与 runner 要求调整为 Vite+ 内置 Vitest，同时保持测试目录、include、template DB、seed 排除和包级测试命令行为。

## Impact

- 归档前需要将既有 `openspec/specs/oxlint-format/spec.md` 从历史 delta 结构规范化为合法主规格结构，保持其现有要求语义，随后本 change 的 delta 才能安全合并。
- 根目录工具依赖、scripts、Vite+ 配置、Oxlint/Oxfmt 配置与锁文件。
- `i18n-studio`、GPM、DSH Telegram 共 34 个测试文件的 imports、测试配置与 package scripts；DSH 仅涉及测试工具接入，不修改已完成 change 确立的业务依赖版本与行为。
- Husky hooks、Node.js CI、README 与开发说明中的质量工具命令。
- 不改变应用运行时 API、部署方式、React Router/Wrangler 命令或 Go 工具链。

## Rollback Plan

若 Vite+ 内置工具在 CI、测试隔离或格式输出上出现不可接受的不兼容，恢复迁移前的独立 Oxlint/Oxfmt/Vitest/`node:test` 依赖、imports、scripts 和 hook 命令，并还原相应锁文件；React Router、Wrangler、类型生成及业务构建命令未被替换，因此无需回滚应用构建架构。
