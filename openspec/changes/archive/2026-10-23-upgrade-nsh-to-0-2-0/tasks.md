# Tasks

## 1. 准备与工具链

- [x] 1.1 备份当前 `~/.nsh` 并记录 `nsh --version` 与 `NSH_SOURCE` 指向的 revision，验证：备份目录存在且版本记录写入变更说明。
- [x] 1.2 安装 v0.2.0 工具链（`NSH_VERSION=v0.2.0 curl -fsSL https://nsh.dev/install.sh | sh`），验证：`nsh --version` 输出 `0.2.0`。
- [x] 1.3 将 `packages/apps/vela/.nsh-version` 改为 `v0.2.0`，验证：文件内容为单行 `v0.2.0`。

## 2. 依赖与宿主代码

- [x] 2.1 更新 `Cargo.toml`：`nsh-core`、`nsh-platform-macos` 改为 `=0.2.0`，新增 `nsh-base = "=0.2.0"`，删除 `nsh-ui-mobile`，验证：`cargo metadata` 可解析。
- [x] 2.2 更新 `host/Cargo.toml`：移除 `nsh-ui-mobile`，加入 `nsh-base`，验证：`cargo check --manifest-path Cargo.toml --workspace` 通过。
- [x] 2.3 将 `host/src/runner.rs` 的 `nsh_ui_mobile::registry()` 改为 `nsh_base::registry()`，验证：`pnpm run check:host` 通过。
- [x] 2.4 更新锁文件：`cargo update -p nsh-core -p nsh-platform-macos -p nsh-base --precise 0.2.0`，验证：`cargo tree -p vela-host | grep nsh` 不再出现 0.1.1。

## 3. TSX 与生成类型

- [x] 3.1 重新生成类型（`pnpm run check:ui`），验证：`ui/.nsh/types` 中出现 `nsh/base` 声明，且 diff 只涉及预期变化。
- [x] 3.2 将 `ui/core/store.ts` 的 `Alert` 改为 `nsh/base` 的 `AlertDialog`，验证：`pnpm run check:ui` 无该文件的类型错误。
- [x] 3.3 将 `ui/features/forwards/ForwardsPage.tsx`、`ui/features/services/ServiceEditorSheet.tsx`、`ui/features/devices/sheets.tsx` 的 `Modal` 改为 `Dialog`，验证：TSX 类型检查通过且三处 Form Sheet 行为不变。
- [x] 3.4 若 `AlertDialog` / `Dialog` 的 props 与旧符号不同，按新类型修正调用点，验证：`pnpm run check:ui` 全绿且无 `any` 兜底。

## 4. 回归与文档

- [x] 4.1 运行 `pnpm run test`，验证：Rust workspace 测试、Go 测试与 UI 结构/主题/视图模型测试全部通过。
- [x] 4.2 运行 `pnpm run verify:release`，验证：App 组装、嵌套签名、协议文档与网络隔离检查全部通过。
- [x] 4.3 手动冒烟：启动打包后的 Vela，检查设备页、服务编辑、转发、日志、设置，验证：无渲染异常、无崩溃、开关与弹窗行为与升级前一致。
- [x] 4.4 更新 `docs/development.md` 的版本表（CLI/runtime `v0.2.0`、crates `=0.2.0`、`nsh-ui-mobile` → `nsh-base`）与 `NSH_SOURCE` revision，验证：文档中的版本与 `Cargo.toml`、`.nsh-version` 一致。
