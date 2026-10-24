# Proposal

## Why

Vela 的两个客户端（macOS 与 iOS）共享同一套控制协议和产品语义，但同一套逻辑在两个平台上各写了一遍：Go 侧有 15 个重复 handler（`remoteSnapshot`、`resolveRemoteService`、`Status` 等），并且已经出现行为漂移；TS 侧两份 `client.ts` 只差 10 行，两份 `store.ts` 的认证、远端管理、偏好流程同形复制；`ui-shared/view-model.mjs` 长成 418 行杂货铺，另附 93 行人工维护的 `.d.mts`；设计 token 存在三处十六进制真源。

这些成本在项目只有 5 个 commit 时是可控的，但它正在以每次改动都要同步两处的方式复利。目录结构也停留在"临时放置"状态：`ios/` 同时是原生宿主和打包工程，`tests/` 只有一篇 README，`ui-shared` 在顶层与 `ui` 平级却没有构建入口。现在重构最便宜，越晚越贵。

## What Changes

- **目录按四类重排**（零语义移动）：`macos/`、`ios/` 存放平台私有实现与打包输入，`shared/` 存放两端共用源码与契约，`core/` 保持单一 Go 模块，`scripts/`、`docs/` 为仓库工具。
  - `ui/` → `macos/ui/`，`host/` → `macos/host/`，`icon/` → `macos/app/`
  - `ui-ios/` → `ios/ui/`，`ios/native/` → `ios/host/`，`ios/Vela*` → `ios/app/`
  - `ui-shared/` → `shared/ui/`，`protocol/` → `shared/protocol/`，新增 `shared/tokens/`
- **Go 单一 Core**：把 `cmd/vela-core/main.go` 内联的读侧 handler 与 `internal/access` 的副本合并为 `internal/vela`（共享读侧）、`internal/app`（macOS 探测与发布编排）、`internal/iosabi`（C ABI）；`cmd/vela-core` 从 581 行收到薄入口；`core/mobile` 迁到 `core/cmd/vela-mobile`。平台的 Policy 差异（映射重试次数、映射地址）改为构造参数，两个平台保持现有行为。
- **TS 共享层**：`createCoreClient(transport)` 取代两份 `client.ts`；`view-model` 按领域拆分为 `services`/`forwarding`/`devices`/`identity`/`diagnostics`/`logs`；共享模块转为 `.ts` 并删除手写 `.d.mts`（若 NSH 或 Node 无法直接消费 `.ts`，退化为按域拆分的 `.mjs` + `.d.mts`）。
- **共享流程**：认证、远端管理、偏好、重命名的输入输出流程抽到 `shared/ui/flows`；状态容器、轮询节奏、`openMapping` 生命周期仍按平台实现。
- **配置单源**：品牌色收敛到 `shared/tokens/base.json` 并由两端测试校验；删除只被测试读取的 `macos/ui/theme.ts`；macOS 的 `Info.plist` 从 `build-app.sh` 的 heredoc 提取为 `macos/app/Info.plist`。
- **文档**：新增 `README.md`（定位、目录地图、命令、文档索引）与 `docs/README.md`；`acceptance.md` 归档到 `docs/verification/`；修正 `LAYERS.md` 中已失效的路径。
- **验证入口收敛**：新增唯一聚合命令 `verify`，`verify:release` 改为 `verify + 组包 + 签名`；把当前遗漏的 4 项 iOS 检查（`nsh check`、UI 测试、`cargo check --target`、`verify-ios-deps.sh`）纳入发布门。
- **唯一的行为对齐**：设备重命名统一做合法 Tailscale 主机名校验（macOS 目前缺失，iOS 已有）。映射重试次数不进共享逻辑，按平台参数化，行为不变。

## Capabilities

### New Capabilities

- `vela-modularity`：定义 Vela 的目录契约、单一 Core 实现、共享层依赖方向，以及唯一验证入口；由跨平台结构测试强制。

### Modified Capabilities

- `vela-private-network`：设备重命名要求补充"必须校验为合法 Tailscale 主机名"，使 macOS 与 iOS 的既有差异归一。

## Impact

- **代码**：`Vela 根目录` 下约 15 个目录、约 900 行被移动或合并，净减约 500 行；不新增运行时依赖。
- **构建与工具**：`package.json` 脚本、`Cargo.toml` workspace members、两个 `nsh.json` 的 `rust` 路径、Xcode 工程 4 处 `$(SRCROOT)` 路径、10 个 shell 脚本引用、`.gitignore`。
- **契约**：控制协议 v1、`config.json` 结构、数据目录、bundle id（`io.implements.vela.macos` / `io.implements.vela.ios`）均不变。
- **发布门**：`verify:release` 覆盖面扩大（新增 iOS），CI 与本地命令保持一致。
- **非目标**：不重写控制协议、不引入代码生成、不改变 UI 视觉、不合并两套 atoms、不动 Rust 的 AppKit 控件实现（只做 smoke 脚本与全局状态收敛）。

## Rollback Plan

- 每个阶段独立提交并保持全绿，失败时按阶段回退，不回退已完成阶段。
- S1（目录移动）语义为零，可整提交 revert；若 Xcode 或 Cargo 路径问题无法在 30 分钟内修复，立即 revert。
- S2/S3 的提取与合并分别独立提交；S3 在删除旧实现前先让新实现跑通行为金测试，删除动作单独一个提交，必要时只回退删除提交即可恢复双实现。
- 若共享 TS 转 `.ts` 的验证失败，回退到 `.mjs` 方案，不影响其他阶段。
