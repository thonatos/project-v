# Proposal

## Why

NSH 的当前发行版是 0.2.0（2026-10-22 发布），UI set 从 `nsh-ui-mobile` 迁移到 `nsh-base`，并补齐了 `Switch`、`RadioGroup`、`Sheet`、`Tabs`、`Tooltip` 等控件。Vela 现锁在 0.1.1，而 iOS 客户端的界面层正好需要这批控件；越晚升级，macOS 与 iOS 两端需要迁移的调用面越大。

## What Changes

- 工具链：NSH CLI 与 runtime 由 `v0.1.1` 升级到 `v0.2.0`，`.nsh-version` 同步。
- Rust 依赖：`nsh-core`、`nsh-platform-macos` 升到 `=0.2.0`；**BREAKING**（仅内部）删除 `nsh-ui-mobile`（0.2.0 不再发布该 crate），改用 `nsh-base`。
- 宿主代码：`host/src/runner.rs` 的 UI set 由 `nsh_ui_mobile::registry()` 改为 `nsh_base::registry()`。
- TSX 迁移：`nsh/ui/mobile` 的 `Alert` 改为 `nsh/base` 的 `AlertDialog`；`Modal` 改名为 `Dialog`（3 个文件）。
- 重新生成 `ui/.nsh/types` 并更新 `Cargo.lock`；`docs/development.md` 的版本表与 `NSH_SOURCE` 的 tag revision 同步。
- 不改变任何用户可见行为、控制协议、HTTP 代理语义或数据库/配置格式。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无。这是工具链与依赖升级，spec 描述的行为不变；本变更在 `.openspec.yaml` 中标记 `skip_specs: true`。

## Impact

- 受影响文件：`Cargo.toml`、`host/Cargo.toml`、`host/src/runner.rs`、`ui/core/store.ts`、`ui/features/forwards/ForwardsPage.tsx`、`ui/features/services/ServiceEditorSheet.tsx`、`ui/features/devices/sheets.tsx`、`.nsh-version`、`Cargo.lock`、`docs/development.md`、`ui/.nsh/types/**`。
- 受影响环境：`~/.nsh`（安装器覆盖 CLI、runtime 与 `embed/ios`，后者体积由约 31MB 增至约 70MB）。
- 不影响：Go Core、控制协议 v1、清单协议 v2、OpenCode/DSH 契约、App 签名与组装流程。
- 前置条件：运行 `pnpm run test` 与 `pnpm run verify:release` 必须全绿，作为行为不变的证据。

## Rollback Plan

- 重装旧工具链：`NSH_VERSION=v0.1.1 curl -fsSL https://nsh.dev/install.sh | sh`。
- 回退依赖与代码：`git checkout Cargo.toml host/Cargo.toml Cargo.lock .nsh-version docs/development.md ui/.nsh/types`，并恢复 4 个 TSX 文件的 `nsh/ui/mobile` 导入。
- 升级前保留一份 `~/.nsh` 副本（或 v0.1.1 的 `nsh-macos-arm64.tar.gz`），以便离线回滚。
