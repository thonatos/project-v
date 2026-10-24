# Design

## Context

动机见 `proposal.md`。当前锁定状态：

| 位置 | 当前值 |
|---|---|
| `packages/apps/vela/.nsh-version` | `v0.1.1` |
| `Cargo.toml` `[workspace.dependencies]` | `nsh-core` / `nsh-platform-macos` / `nsh-ui-mobile` 均为 `=0.1.1` |
| `host/Cargo.toml` | 同上三者 |
| `host/src/runner.rs` | `nsh_ui_mobile::registry()` |
| `ui/*` 对 `nsh/ui/mobile` 的引用 | `Alert`（`ui/core/store.ts`）、`Modal`（3 个文件） |
| `NSH_SOURCE` | 指向 NSH 源码 checkout，文档记录 revision `21101386…` |

已核对 0.2.0 的公开事实（对照 crates.io 源码）：

- `nsh-ui-mobile` 只有 `0.1.0` / `0.1.1`，没有 0.2.0；UI set 迁移到新 crate `nsh-base`（只有 `0.2.0`）。
- `nsh-platform-macos 0.2.0` 直接依赖 `nsh-base ^0.2.0`。
- macOS 平台 API 对本项目只增不减：`AppView::new(mtm, AppOptions)`、`register_component`、`Components`、`set_ui_sets`、`set_fps_monitor`、`ComponentContext`、`NativeComponent` 全部保留，新增 `set_root`、`quit_app`、`set_limits`、`set_locale`、`set_font_scale`。
- iOS 嵌入 API（`AppView::new(mtm, frame, SurfaceOptions)`、`register_component`、`load`、`run`）在 0.1.1 与 0.2.0 之间不变。
- 导航原语改名：`Stack`→`NavStack`、`Screen`→`NavPage`、`Modal`→`Dialog`、`createNavigator`→`createNavStack`。
- `nsh/desktop` 的 `Menu`（`setApplicationMenu`）与 `Window` 保留；`nsh/list`、`nsh/native`、`nsh/clipboard`、`nsh/device`、`nsh/keymap` 保留。

`0.2.0` 发布于 2026-10-22，距本变更只有一天；这也是把“只做必要迁移、不顺手重构”定为原则的原因。

## Goals / Non-Goals

**Goals:**

- 工具链、Rust crates、生成类型与文档版本四处一致，没有混用窗口。
- 用户可见行为完全不变：同样的页面、同样的交互、同样的协议。
- 任何一步失败都能在 10 分钟内回滚到 0.1.1。
- 为后续 iOS 变更提供 `nsh-base` 的控件集（`Switch`、`RadioGroup`、`Sheet`、`ContextMenu`）。

**Non-Goals:**

- 不借升级重写 UI 原子层、不改布局、不改文案。
- 不升级 Go、`tailscale.com`、Rust toolchain 或 Xcode。
- 不引入 `nsh-base` 的新组件到 macOS 界面（留给 iOS 变更按需使用）。
- 不追随 0.2.x 的后续补丁版本；本次只锁 `0.2.0`。

## Decisions

### 1. 现在升级，而不是停留 0.1.1

0.1.1 仍可用，但它缺少 iOS 原子层需要的 `Switch`、`RadioGroup`、`Sheet`、`ContextMenu`。若先做 iOS 再升级，iOS 的控件需要先自绘一遍，升级时再改一遍。升级的 macOS 侧成本已经确认很小（1 个 registry 调用 + 2 个符号），因此前置升级的期望总成本更低。

替代方案是“iOS 变更直接基于 0.1.1，永不上 0.2.0”。否决理由是版本差会随每次 NSH 发布继续拉大，而本次迁移面已经接近最小。

### 2. `nsh-base` 取代 `nsh-ui-mobile`，不做兼容层

两个 crate 不能同时注册为 UI set：组件导出名会重复（`Button`、`Sheet`、`Switch` 等），`set_ui_sets` 会得到冲突的注册表。因此直接移除 `nsh-ui-mobile`，不保留 feature flag 或条件编译。

### 3. 只做符号级迁移，不重排 UI

迁移范围严格限定在“编译与类型检查要求的最小改动”：

| 位置 | 改动 |
|---|---|
| `host/src/lib.rs` | `#[module]` 需同时标注在 `CoreBridge` 结构体上（0.2.0 宏要求） |
| `host/src/runner.rs` | `nsh_ui_mobile::registry()` → `nsh_base::registry()` |
| `ui/core/store.ts` | `Alert.alert(title, message, buttons)` → `AlertDialog.show({ title, description, actions })`，并抽出 `confirmDestructive` 统一 4 处调用 |
| `ui/features/forwards/ForwardsPage.tsx`、`ui/features/services/ServiceEditorSheet.tsx`、`ui/features/devices/sheets.tsx` | `Modal` → `Dialog`：`visible` → `open`、`onRequestClose` → `onOpenChange`、`desktop.presentationStyle` → 顶层 `presentation` |
| `ui/ui/*` 与 `ui/features/*` | 属性重命名：`accessibilityRole` → `role`、`showsIndicator` → `scrollbar`、`contentContainerClass` → `contentClass`、`onChangeText` → `onChange`、`onSubmitEditing` → `onSubmit`、`editable` → `readonly`（语义取反） |
| `ui/core/store.ts`、`ui/features/settings/SettingsPage.tsx` | `Clipboard.setString` → `Clipboard.writeText` |
| `ui/features/devices/sheets.tsx` | `List` 的 `ListEmptyComponent` → `empty` |

实际迁移面比最初按 `nsh/ui/mobile` 导入检索的估计更大：0.2.0 同时重命名了核心组件的无障碍与输入属性。这些都仍是符号级替换，没有重排 UI 或改动布局。

`Dialog` 与旧 `Modal` 在 macOS 上的呈现方式有一处差异：0.2.0 的 `Dialog` 是窗口内的模态层，旧 `Modal` 的 `desktop.presentationStyle: "formSheet"` 走的是窗口 sheet。为保持视觉一致，新增原子 `FormSheetDialog`（`ui/ui/sheet.tsx`）统一承载四个表单弹窗：

- 弹窗宽度 392pt = `480 − 56(导航轨道) − 2×16(页面边距)`，在内容区内居中，与页面内容边界对齐，不压到导航轨道；
- 遮罩只覆盖内容区（`left-14`），导航轨道保持原色；
- 背景为“模糊层 + 压暗层”两层：`backdrop-blur-lg`（NSH 的 `NSVisualEffectView`，material 固定 `.popover`）以 `opacity-80` 参与合成，再叠 `surfaces.veil` 的 25% 文字色遮罩；
- `animation="fade"`：`Dialog` 默认 `slide` 会让整层遮罩从底部滑入，视觉上像“背景弹上来”。

这条实现引入了“模态背景允许半透明 + 模糊”，是对归档设计规则“不得出现半透明遮罩”的收窄：范围仅限模态背景，其余表面仍使用不透明 token。

### 4. 工具链与 crates 必须同步移动

`.nsh/types` 由 CLI 生成，`nsh/base` 与 `nsh/ui/mobile` 的声明差异直接来自 CLI 版本。允许“CLI 0.2.0 + crates 0.1.1”会出现类型指向不存在的模块，反之则缺少新组件声明。因此顺序固定为：装 CLI → 改 crates → 重生成类型，中间不运行 `check:ui` 之外的命令。

`NSH_SOURCE` 同理：它参与 Rust 集成侧的代码生成，必须切到 v0.2.0 对应的 commit，并与 `docs/development.md` 记录的 revision 一致。

### 5. 用现有回归作为“行为不变”的证据

本变更不新增行为，因此不新增测试；验收依赖既有门禁：

```text
              +---------------------------+
  装 CLI 0.2.0 |  nsh --version == 0.2.0   |
              +-------------+-------------+
                            v
              +---------------------------+
              |  Cargo pin -> 0.2.0       |
              |  nsh-ui-mobile -> nsh-base|
              +-------------+-------------+
                            v
              +---------------------------+
              |  check:host (cargo check) |
              +-------------+-------------+
                            v
              +---------------------------+
              |  check:ui (types + tsc)   |
              +-------------+-------------+
                            v
              +---------------------------+
              |  test（Rust + Go + UI）    |
              +-------------+-------------+
                            v
              +---------------------------+
              |  verify:release（组装+签名）|
              +-------------+-------------+
```

任何一步失败都回到上一个可编译状态，而不是继续往下改。

## Risks / Trade-offs

- [0.2.0 发布仅一天，可能存在未被上游发现的缺陷] → 锁死 `=0.2.0`，不跟随补丁；出现阻塞问题时按回滚计划退回 0.1.1，等 0.2.x 稳定后再试。
- [`Alert` → `AlertDialog` 的选项结构可能变化] → 以 `nsh check` 生成的类型为准；变化限于 `ui/core/store.ts` 一处调用。
- [`Modal` → `Dialog` 的呈现参数可能变化] → 三处 Form Sheet 的调用点集中，逐个对照类型修正。
- [CLI 与 `NSH_SOURCE` revision 不一致导致静默漂移] → 升级后执行一次 `nsh check` 并确认 `ui/.nsh/types` 的 diff 只包含预期变化。
- [`~/.nsh` 被覆盖后无法退回] → 升级前保留 `~/.nsh` 副本或 v0.1.1 安装包。
- [`embed/ios` 由约 31MB 增至约 70MB] → 只影响开发机磁盘，不进入 macOS App 产物。

## Migration Plan

1. 备份 `~/.nsh`，记录当前 `nsh --version` 与 `NSH_SOURCE` 指向的 revision。
2. 安装 v0.2.0 工具链，确认 `nsh --version`。
3. 更新 `.nsh-version`、`Cargo.toml`、`host/Cargo.toml`。
4. 改 `runner.rs` 的 registry，`cargo check` 通过。
5. 更新 `Cargo.lock`，确认依赖树无 0.1.1 残留。
6. 重生成并修正 `ui/.nsh/types`，通过 `check:ui`。
7. 修 4 个 TSX 调用的符号。
8. 跑 `test` 与 `verify:release`。
9. 更新 `docs/development.md` 与 `NSH_SOURCE` revision。

回滚：重装 v0.1.1 工具链，`git checkout` 第 3–6 步涉及的文件与 `Cargo.lock`，恢复 4 个 TSX 文件的导入。

## Open Questions

- 是否在升级后立即把 macOS 的“共享/日志”布尔项换成 `nsh-base` 的 `Switch`（当前是自绘 `NSSwitch` 原生组件）。这属于界面改进，不影响本次升级，留给后续独立变更。
