# Tasks

## 1. S0 护栏（生产代码零改动）

- [x] 1.1 新增 `tests/structure.test.mjs`：扫描 TS/TSX 的 import 图，断言平台目录不互相引用、共享模块不引用平台目录；先在当前目录结构下按「允许清单」落地，并让 `verify` 调用它。验证：`node tests/structure.test.mjs` 通过；临时在 `ui/` 中写入一条指向 `ui-ios/` 的 import 后测试失败，随后删除。
- [x] 1.2 为 Go 读侧载荷补金测试：`status` 与 `remotes` 响应的键集合、`remoteSnapshot` 在 offline/connected/incompatible/unauthorized 四种状态下的字段。验证：`go test -C core ./internal/access ./cmd/vela-core` 通过，且新增测试在未改实现时即可通过（锁住现状）。
- [x] 1.3 为映射策略补特征测试：iOS 的 3 次重试与退避、macOS 当前不重试的行为。验证：对应包的 `go test` 通过，测试名明确写出「当前策略」。
- [x] 1.4 为可测的纯投影补齐特征测试（`nextDeviceID`、`connectionCommand`、`targetKey`、`logRows` 排序与过滤、`serviceBadge` 状态优先级）。验证：`node ui/tests/view-model.test.mjs` 与 `node ui-ios/tests/view-model.test.mjs` 通过。
- [x] 1.5 新增 `scripts/verify.sh` 聚合入口并接入 `package.json` 的 `verify`；`scripts/verify-release.sh` 改为「调用 verify，再组包与签名」。验证：`pnpm -F vela verify` 通过，报告写入 `.tmp/release/`。
- [x] 1.6 把当前遗漏的 iOS 检查并入 `verify`：`nsh check ui-ios/App.tsx`、`ui-ios` 的 3 个 node 测试、`cargo check --target aarch64-apple-ios -p vela-ios-native`、`verify-ios-deps.sh`。验证：逐个运行通过；临时让 `ui-ios/tests/structure.test.mjs` 的某个断言失败，确认 `verify` 返回非零后还原。
- [x] 1.7 更新 `tests/README.md`：说明结构测试与本仓的依赖不变量，并列出每条既有「源码形态断言」的处理去向（保留 / 转为行为测试 / 删除理由）。验证：`pnpm -F vela verify` 仍通过，且文档中的命令可照抄执行。

## 2. S1 目录移动（零语义）与文档

- [x] 2.1 用 `git mv` 完成平台优先重排：`ui/` → `macos/ui/`、`host/` → `macos/host/`、`icon/` → `macos/app/`；`ui-ios/` → `ios/ui/`、`ios/native/` → `ios/host/`、`ios/Vela*` → `ios/app/`；`ui-shared/` → `shared/ui/`、`protocol/` → `shared/protocol/`；`core/mobile/` → `core/cmd/vela-mobile/`。验证：`git status` 只显示 rename，`git diff --stat` 无内容改动。
- [x] 2.2 更新全部路径引用：`package.json` 脚本、`Cargo.toml` 的 workspace members、两个 `nsh.json` 的 `rust`（均为 `../host`）、`build-app.sh`、`build-ios.sh`、`build-ios-core.sh`、`verify-ios-deps.sh`、`verify-release.sh`、`.gitignore`、Xcode 工程 4 处 `$(SRCROOT)`、两个平台测试中的相对路径。验证：`pnpm -F vela verify` 通过；`cargo metadata --locked --no-deps` 可解析；`build:app` 与 `build:ios` 均成功。
- [x] 2.3 将 `1.1` 的结构测试切到最终目录规则：`macos/**`、`ios/**` 可依赖 `shared/**`、`core/**`，反向禁止，平台之间禁止。验证：测试通过；临时在 `shared/ui` 中引用 `macos/ui` 后失败，随后删除。
- [x] 2.4 新增 `README.md`（定位、四类目录职责、平台能力矩阵、构建与验证命令、文档索引）与 `docs/README.md`（按读者分类）；将 `sharing-and-dsh.md` 更名 `sharing.md`、`control-protocol.md` 更名 `protocol.md`、`app-boundary.md` 更名 `architecture.md`；`acceptance.md` 归档到 `docs/verification/`；同步更新 `verify-docs.sh` 中的文档路径。验证：`verify-docs.sh` 通过；照 README 中的命令执行一次构建。
- [x] 2.5 修正 `macos/ui/LAYERS.md`（`view-model` 已迁出、路径已变），并新增 `ios/ui/LAYERS.md` 说明 iOS 的分层契约；更新 `docs/ios.md` 与 `docs/development.md` 中的路径与命令。验证：文档中的每条命令可执行；`verify` 通过。
- [x] 2.6 包名与模块路径从 Vela 自身计算：npm 包名改为 `vela`，Go module 改为 `github.com/thonatos/vela/core`，更新全部 import、脚本与文档引用；不再出现 `project-v` 路径。验证：`go build -C core ./...` 与 `pnpm -F vela verify` 通过；`git grep 'project-v/vela\|@project-v/vela'` 无结果。

## 3. S2 TS 共享层

- [x] 3.1 运行 `.ts` 迁移 spike：确认 Node 24 能直接导入 `.ts`，且 `nsh check`/`nsh build` 能解析应用根之外的 `.ts`。验证：一个仅含类型的共享模块被两端 `nsh check` 与 node 测试同时引用成功；记录结论到 `design.md` 的 Open Questions。
- [x] 3.2 在 `shared/ui/client.ts` 实现 `createCoreClient(transport)`，两端 `core/client.ts` 改为扩展共享客户端（平台专属方法保留）。验证：两端 `nsh check` 通过；`tests/structure.test.mjs` 断言全仓只有一处 `CoreBridge.request`。
- [x] 3.3 将 `view-model` 拆为 `services`/`forwarding`/`devices`/`identity`/`diagnostics`/`logs` 六个领域模块并更新全部导入。验证：两个 `view-model.test.mjs` 通过；两端 `nsh check` 通过。
- [x] 3.4 按 3.1 结论迁移类型：通过则转 `.ts` 并删除 `view-model.d.mts`，不通过则按域拆 `.d.mts`。验证：`nsh check` 两端通过；`shared/ui` 中不存在与实现重复的整文件手写声明。
- [x] 3.5 把共享投影测试迁到 `shared/ui/`，平台专属测试保留在各自 `tests/`，并更新 `verify` 的路径。验证：`verify` 通过且测试文件按归属分布正确。

## 4. S3 Go 单一 Core

- [x] 4.1 新建 `internal/vela`：迁入读侧（状态、映射、认证、远端、设备、偏好、诊断、`control.Server` 装配），把重试次数、映射地址、manifest 端口改为 `Options`。验证：迁移后的包 `go test` 全绿；两端传入各自现值后行为与 `1.3` 的特征测试一致。
- [x] 4.2 新建 `internal/app`：迁入 `probeServices`、`dshLaunch`、`publications`、`sharing` reconcile、`ServiceUpsert`/`ServiceRemove`，以装饰方式替换 `Status` 并追加共享/服务 handler。验证：`go test ./internal/app` 通过；`1.2` 的载荷金测试在新实现下通过。
- [x] 4.3 新建 `internal/iosabi`：迁入 `Bridge` 与 iOS 专属选项；`cmd/vela-mobile` 成为 C ABI 薄壳。验证：`go build ./...`；`verify-ios-deps.sh` 确认 iOS 入口不链接 publication/sharing/services/authorization/inbound。
- [x] 4.4 `cmd/vela-core` 瘦身为装配（参数解析、构造 `app`、`Run`），载荷从 `map[string]any` 改为包内结构体并保持 JSON 键不变。验证：`go test -race ./...`；`verify-protocol-docs.sh` 通过；`verify` 全绿。
- [x] 4.5 删除 `internal/access` 与旧的 `core/mobile`，更新依赖检查中的包名。验证：`go test -race ./...` 与 `verify` 通过；`go list -deps ./cmd/vela-mobile` 不含被禁止的包。
- [x] 4.6 更新 `docs/architecture.md` 与 `docs/development.md` 的进程模型、包职责与 Go 构建命令。验证：文档命令可执行；`verify-docs.sh` 通过。

## 5. S4 共享 TS 流程

- [x] 5.1 抽取 `shared/ui/flows/auth.ts`（登录、检查、重连、注销、错误映射），两个平台接入并删除各自的重复实现。验证：新增流程单测覆盖成功、失败与 needs-auth 三种路径；两端 `nsh check` 与 `verify` 通过。
- [x] 5.2 抽取 `shared/ui/flows/remotes.ts`（开始添加、选择、提交、移除），平台差异（关闭方式、提示文案）由回调注入。验证：流程单测通过；两端 `nsh check` 通过。
- [x] 5.3 抽取 `shared/ui/flows/preferences.ts` 与 `flows/rename.ts`；主机名校验规则同时落到 Go 的 `DeviceUpdate`，用例集放 `shared/protocol/fixtures/hostname-validation.json`，Go 与 TS 测试读同一份。验证：两端语言各跑同一用例集全绿；非法名在两端都被拒绝。
- [x] 5.4 删除两个 store 中已被共享的流程代码，并在结构测试中禁止再次出现重复的认证/远端/偏好实现。验证：`verify` 通过；`store.ts` 行数下降且只保留平台状态机与编排。

## 6. S5 配置与打包单源

- [x] 6.1 新增 `shared/tokens/base.json` 保存品牌色明暗值，两端校验测试断言各自 `nsh.json` 的共享子集与真源一致；删除 `macos/ui/theme.ts`，把 4pt、字体与对比度断言改为直接读 `nsh.json`。验证：token 校验通过；改动一处共享色值后两端校验自动跟随，手工改单端则失败。
- [x] 6.2 将 `build-app.sh` 中的 `Info.plist` heredoc 提取为 `macos/app/Info.plist`，构建脚本改为复制；同步把 `AppIcon.icon` 的引用指向 `macos/app/`。验证：`build:app` 成功且 `codesign --verify --deep --strict` 通过，`Info.plist` 键与改动前一致。
- [x] 6.3 更新 `docs/architecture.md` 中的 bundle 结构与打包输入说明。验证：`verify-docs.sh` 通过；文档路径与实际文件一致。

## 7. S6 Rust 收尾

- [x] 7.1 将 `host` 中的 smoke 脚本（`VELA_LIFECYCLE_SCRIPT`、`VELA_UI_SMOKE`）移出生产启动路径，收进独立模块并由显式环境变量门控。验证：`cargo test` 与 `clippy -D warnings` 通过；生产启动路径不再直接调用 smoke 函数（代码检索确认）。
- [x] 7.2 将 `supervisor` 的 `global_*` 自由函数收敛为一次性初始化的结构体访问，保持 `CoreBridge` 的对外行为不变。验证：`cargo test --locked --workspace` 通过；`CoreBridge` 的协议测试无改动。
- [x] 7.3 把 `desktop_controls` 中重复的颜色构造收敛为表驱动。验证：`cargo clippy --workspace --all-targets -- -D warnings` 通过；控件视觉取值与改动前一致（比对颜色常量表）。
- [x] 7.4 更新 `docs/architecture.md` 中宿主进程与调试开关的说明。验证：`verify-docs.sh` 通过。

## 8. 集成验收

- [x] 8.1 运行 `pnpm -F vela verify:release`（聚合验证 + 两端组包 + 签名）。验证：命令返回 0，`.tmp/release/` 中每段报告存在且无失败段。
- [ ] 8.2 手工验收：macOS 双机共享与转发、iOS 只读访问与自动重试、非法设备名被拒绝、窗口关闭常驻与退出清理。验证：结果记录到 `docs/verification/`，不含凭据与页面内容。
- [x] 8.3 全仓检查：`pnpm check`、`pnpm test` 通过；`openspec validate refactor-vela-structure --strict` 通过。验证：三条命令均返回 0。
- [x] 8.4 将 Vela 格式化为仓库标准（`vp fmt`）：消除 86 个文件的格式差异，`pnpm check` 转绿；同步把引号敏感的源码断言改为引号无关，并把 `App.tsx` 行数上限从 120 调到 160（格式器把菜单表拆成一行一项）。验证：`pnpm check` 返回 0；`pnpm -F vela verify:release` 通过。


## Workflow follow-up

- 评审通过后归档变更，并确认主规格中出现 `vela-modularity`。
- 归档后重跑一次 `verify:release`，确认归档未影响构建。
