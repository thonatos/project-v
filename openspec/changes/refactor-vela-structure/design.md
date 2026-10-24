# Design

## Context

- Vela 是两个应用共享一套 Core 的产品：macOS 客户端负责共享与发布，iOS 客户端只读访问。当前两个平台各有一套 Go 组合根和一套 TS store，重复逻辑已经出现行为漂移（映射重试、重命名校验、轮询节奏）。
- 构建约束：
  - NSH 要求 `nsh.json` 与 TSX 入口同目录，其 `rust` 字段指向该应用的 Rust crate。因此「界面」和「原生宿主」必须是两个可独立定位的目录。
  - Go 的 `internal/` 只允许模块内、以 `internal` 父目录为根的包导入。若把 Go 代码按平台拆到 `macos/`、`ios/`，必须把 `go.mod` 提到根并重写全部 import；否则平台入口必须留在模块内。
  - Xcode 工程内部引用相对 `$(SRCROOT)`，`cargo -p <crate>` 按 crate 名而非路径解析。整目录移动只需改 `members` 与 4 处 `$(SRCROOT)/../build`。
  - 现有结构测试用正则断言源码形态（`ui/tests/desktop-layout.test.mjs`，219 行），并硬编码了 `../host/src`、`../ios/native` 等路径。它是重构的主要摩擦力。
- 规模：Go 8,358 行（含测试）、Rust 3,712 行、TS/TSX 约 3,400 行；189 个受版本控制文件。

## Goals / Non-Goals

**Goals:**

- 每个跨平台能力只有一份实现；平台差异只能出现在参数或平台编排层。
- 依赖方向可机械检查：平台可依赖共享，共享不可依赖平台，平台之间不互相依赖。
- 目录移动零语义，可单独提交、单独回退。
- 一个聚合验证命令覆盖两端；发布门复用同一命令。
- 文档描述的目录、命令与仓库实际一致。

**Non-Goals:**

- 不改变控制协议 v1、`config.json` 结构、数据目录与 bundle id。
- 不合并两套 UI atoms：桌面密度与 44pt 触控密度的组件集本就不同。
- 不引入协议代码生成，不改写 Rust 的 AppKit 控件实现。
- 不调整视觉设计；品牌色只换存放位置，不改色值。
- 不改变两个平台现有的映射重试次数、轮询节奏与映射地址策略。

## Decisions

### D1 平台优先的四类顶层目录

```
vela/
  macos/     平台私有：ui/ host/ app/
  ios/       平台私有：ui/ host/ app/
  shared/    两端共用：ui/ protocol/ tokens/
  core/      单一 Go 模块
  scripts/ docs/
```

依赖规则（由 S0 的结构测试强制）：

```
macos/**, ios/**    -> shared/**, core/**   允许
shared/**, core/**  -> macos/**, ios/**     禁止
macos/**            -> ios/**               禁止
ios/**              -> macos/**             禁止
```

理由：两个平台的实现各自成岛，查找与边界都直接；`nsh.json` 的 `rust` 路径在两平台都变成 `../host`，与 NSH 自身 `macos-host` / `ios-host` 的词汇一致。

备选与取舍：

- **角色优先**（`ui/macos`、`host/ios`）：重复代码相邻、漂移更显眼，但路径变长（`../../host/macos`），新增平台要在三个顶层目录各加一层。
- **保持现状只改命名**：改动最小，但 `ios/` 仍然同时是宿主和打包工程，问题没有消失。

选择平台优先的前提是 `shared/` 真的装进共享实现；否则只是给重复换个标签。因此 S1（移动）之后必须完成 S2-S4（提取），不能停在中途。

`shared/` 的准入条件：两端都会编译/链接进去，或两端都消费的契约。禁止"顺手放这儿"。

### D2 `core/` 保留在顶层，模块内按能力分层

```
core/
  cmd/vela-core/          macOS 入口：装配 app
  cmd/vela-mobile/        原 mobile/：C ABI 薄壳
  cmd/network-isolation/
  internal/vela/          共享读侧：config/journal/checker/registry/manager/session/node
  internal/app/           macOS 编排：probeServices、dshLaunch、publications、sharing、服务编辑
  internal/iosabi/        原 access.Bridge：C ABI 管道 + iOS 选项
```

不把 Go 放进 `shared/`：Go 的 `internal/` 可见性使平台入口无法移出模块，把平台专属的 `app`、`iosabi` 放进名为 `shared` 的目录会让目录名说谎。备选是把 `go.mod` 提到 Vela 根、共享包放 `shared/go`、平台入口放 `macos/core` 与 `ios/core`，代价是 63 个文件改 import 且失去 `internal/` 封装，收益只是树更整齐，不采纳。

### D3 读侧无副作用，平台用装饰器补齐

`internal/vela` 的 `Status` 只返回快照，不探测、不发布。macOS 的"取状态顺带 reconcile"发生在 `internal/app`：

```
macOS  control.Server.status -> app.Status
                               |-- probeServices(ctx)              探测本地服务
                               |-- publications.Reconcile(...)    发布/撤销共享
                               `-- vela.Status(ctx) + Services/Sharing 字段

iOS    control.Server.status -> vela.Status(ctx)
                               `-- 无探测、无发布
```

同一份 `control.Server` 结构，`app` 在 `vela` 的装配结果上替换 `Status` 并追加共享/服务 handler；iOS 直接使用 `vela` 的装配结果。载荷改为包内结构体（如 `vela.Snapshot`）再序列化，替代现在两处各自拼的 `map[string]any`，并用 `shared/protocol/fixtures` 做键集合金测试。

### D4 平台差异参数化，不写进共享逻辑

| 差异 | 表达方式 | 结果 |
|---|---|---|
| 映射重试次数（iOS 3，macOS 0） | `Options.RetryAttempts` | 行为不变 |
| 映射地址（iOS 固定 127.0.0.1，macOS 稳定 hostname） | `Options.Address` | 行为不变 |
| 远端 manifest 端口（测试覆盖） | `Options.ManifestPort` | 行为不变 |
| 前台挂起/恢复 | `vela.Core.Suspend/Resume`，macOS 不调用 | 行为不变 |

### D5 共享 client 用注入的 transport

`shared/ui/client.ts` 导出 `createCoreClient(transport)`，两个应用各自传入 `CoreBridge.request`。`shared/` 不直接 import `vela/native`：那是应用作用域的虚拟模块，每个应用要各自维护路径映射；注入后共享模块可在纯 Node 测试中运行，协议方法表也只有一份。

### D6 `shared/ui` 按领域拆分，优先转 `.ts`

```
shared/ui/
  client.ts  envelope.ts  model.ts  protocol.ts
  services.ts     预设、表单校验、目标归一化（macOS 消费，规则与 Go 对齐）
  forwarding.ts   端点解析、连接命令、共享警告（macOS 消费）
  devices.ts      远端设备投影、分组、徽标（两端消费）
  identity.ts     登录态、用户标签、首字母（iOS 消费）
  diagnostics.ts  诊断快照与摘要行（两端消费）
  logs.ts         日志行与级别计数（两端消费）
  flows/          auth.ts remotes.ts preferences.ts rename.ts
```

转 `.ts` 的前置验证（只读 spike）：Node 24 的类型剥离能否直接导入 `.ts`；NSH 的打包与类型检查能否解析应用根之外的 `.ts`。任一不通过则保留 `.mjs`，按域拆 `.d.mts`，其余决策不变。

### D7 共享流程的边界

共享（输入输出型，无状态容器）：认证、远端增删、偏好读写、重命名校验。
不共享（平台语义不同）：`pane/selected/forwards` 与 `tab/modals/stage` 状态机、轮询节奏、`openMapping` 的失败重试与舞台切换、atoms。

备选是合并两个 store，不采纳：会把两套状态机压成大量分支，比重复更难读。

### D8 品牌色单源，删除假主题模块

`shared/tokens/base.json` 保存 accent/success/warning/danger 的明暗值；两端 `nsh.json` 保留平台专属调色板，测试断言共享子集与真源一致。删除 `macos/ui/theme.ts`——它运行时不 import 任何人，只被测试用正则读取，属于冒充主题模块的测试夹具；对比度、4pt 与字体断言改为直接读 `nsh.json`。

备选是从 base 生成 `nsh.json`：真源更彻底，但增加代码生成步骤并在评审中出现生成文件，暂不采用；色值继续频繁变动时再升级。

### D9 唯一聚合验证入口

新增 `scripts/verify.sh`，分段执行：文档/协议/网络隔离 → macOS UI（check + node 测试 + token 校验）→ iOS UI（check + node 测试）→ Rust（fmt + test + clippy，两个宿主）→ Go（race 测试）→ 依赖边界（`verify-ios-deps.sh` + 平台引用扫描）。`package.json` 的 `verify` 调用它；`verify:release` = `verify` + 两端组包 + 签名。

```
pnpm -F vela verify
  |-- tests/structure.test.mjs      平台/共享依赖方向
  |-- verify-docs.sh / verify-protocol-docs.sh / verify-network-isolation.sh
  |-- macos/ui: nsh check + node 测试
  |-- ios/ui:   nsh check + node 测试 + verify-ios-deps.sh
  |-- rust: fmt + test + clippy
  |-- go:   test -race ./...
  `-- 报告写入 .tmp/release/
verify:release = verify + build-app + build-ios + codesign
```

### D10 测试分两类，形态断言改为行为断言

- 保留为**不变量**：依赖方向、只有一个请求发送点、token 纪律、行高与密度约束、发布门覆盖。
- 改为**行为**：`store.ts` 里被正则断言的逻辑（陈旧映射尝试不得复活、只有 HTTP 转发交给浏览器、轮询延迟选择、重命名校验、认证流程的错误映射）在提取后由纯函数单测覆盖。

### D11 主机名校验一条规则、两种语言、一份用例

Go 的 `vela.DeviceUpdate` 是权威校验；`shared/ui/flows/rename.ts` 提供同一规则的即时反馈。两边共用 `shared/protocol/fixtures/hostname-validation.json` 的用例集，避免"界面允许、Core 拒绝"。

### D12 映射打开的合并路径

```
iOS   ui-ios/core/store.openService
        | shared client: mapping.open
        v
      ios/host CoreBridge ---> iosabi.Bridge ---> control.Server --.
                                                                   |
macOS ui/core/store.forwarding.start                               |
        | shared client: mapping.open                              |
        v                                                          |
      macos/host CoreBridge --> supervisor --> stdin/stdout --> cmd/vela-core
                                                                   |
                                                                   v
                                                        vela.Core.OpenMapping(ctx, key)
                                                          resolveRemoteService(checker)
                                                          refreshWithRetry(Options.RetryAttempts)
                                                          session.Open(key)
                                                          published.Path 拼接
```

两条传输（C ABI 管道 / 子进程管道）在 `control.Server` 处汇合，读侧只有一份实现；差异只剩 `Options` 与 macOS 侧的发布编排。

## Risks / Trade-offs

| 风险 | 影响 | 对策 |
|---|---|---|
| 合并后 macOS `Status` 的 reconcile 副作用位置变化 | 共享状态可能不刷新 | 副作用显式留在 `app.Status`；用金测试比较合并前后 `status` 载荷键与 `services` 字段 |
| 合并改变 macOS 映射行为 | 用户可见的连接时序变化 | 重试次数参数化（macOS 传 1，等价于不重试）；S0 先写特征测试锁住现有行为 |
| Xcode / Cargo 路径在移动后失效 | iOS 无法构建 | 移动提交后立即跑 `build:ios` 与 `cargo metadata`；30 分钟内修不好即回退该提交 |
| `shared/` 变成第二个杂货铺 | 结构问题复发 | 写入准入条件，并由结构测试检查共享模块的依赖与消费者 |
| `.ts` 迁移被 NSH 拒绝 | 共享层类型方案回退 | 前置 spike；回退到分域 `.mjs` + `.d.mts`，不影响其他阶段 |
| 流程抽取过度抽象 | 可读性下降 | 边界固定为 D7；只抽输入输出，不抽状态容器与生命周期 |
| 结构测试改写后放松了原本的约束 | 回归漏检 | S0 先把每条形态断言映射到一个行为测试或明确删除理由，逐条记录 |

## Migration Plan

每个阶段一个提交序列，阶段内保持全绿；失败按阶段回退。

| 阶段 | 内容 | 验收门 | 回退 |
|---|---|---|---|
| S0 护栏 | 特征测试（Go 载荷与策略、TS 流程与校验）、跨平台结构测试、`verify` 聚合入口 | `pnpm -F vela verify` 通过，生产代码零改动 | 纯增量，revert 即可 |
| S1 目录 | 平台优先重排、`tests/` 复用为结构测试、`verify-docs` 与脚本路径更新 | `verify` + `build:app` + `build:ios` 通过，`git diff` 仅路径 | 单提交 revert |
| S2 TS 共享 | `createCoreClient`、view-model 分域、`.ts` spike 与迁移、删除 `.d.mts` | 两端 `nsh check` + node 测试 + `verify` | 按域独立 revert |
| S3 Go 单核心 | `internal/vela`、`internal/app`、`internal/iosabi`、`cmd` 瘦身、结构化载荷 | `go test -race ./...` + `verify-ios-deps` + 载荷金测试 + `verify` | 删除旧实现单独提交，可只回退该提交恢复双实现 |
| S4 共享流程 | auth/remotes/preferences/rename 抽取，校验规则统一 | 流程单测 + `verify` | 按流程独立 revert |
| S5 配置单源 | `shared/tokens/base.json`、删 `theme.ts`、提取 `macos/app/Info.plist` | token 校验 + `verify` + `build:app` 签名 | 独立 revert |
| S6 Rust 收尾 | smoke 脚本移出生产路径、`supervisor` 全局状态收敛、颜色函数表驱动 | `cargo test` + `clippy -D warnings` + `verify` | 独立 revert |

Rust 未在本变更的早段处理：它与 Go/TS 的重复问题不相干，放在最后可以避免与目录移动同时改动。

## Open Questions

- `.ts` 迁移的 spike 已通过（2026-10）：Node 24 可直接导入共享 `.ts`，`nsh check` 与 `nsh build` 能解析并打包应用根之外的 `.ts`。3.4 按 `.ts` 执行，保留回退路径以防后续 NSH 版本变化。
- 品牌色是否需要从校验升级为生成（S5 之后按色值改动频率决定）。
- Rust smoke 脚本最终形态（S6 决定：环境变量门控的独立模块，或彻底移出生产二进制）；不影响其他阶段。
