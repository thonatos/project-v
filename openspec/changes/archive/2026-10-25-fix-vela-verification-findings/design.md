# Design

## Context

验收发现的 8 个问题集中在两处：一是两个客户端在账户、设置、日志、设备四页各自演化出了不同的词表、区块与控件；二是 iOS 首屏被节点启动阻塞，macOS 的协议版本写死且缺版本信息。当前代码状态：

- iOS 账户页已有「头像 + 名称 + 状态 chip」身份头，但「私人连接」区块重复显示账户；macOS 账户页没有身份头，账户只在区块行出现。
- macOS 的 `Segmented`、`Avatar`、`IconTile`、`Dot` 四个 atom 不存在；日志级别用 4 个独立 `Button`。
- `network.Embedded.LocalClient()` 调用 `Start()`，而 `Start()` 内部是 `sync.Once.Do`；iOS 在后台 goroutine 启动节点后，第一次 `status.get` 会卡在同一个 `once` 上直到 tsnet 就绪。
- `network.AuthState` 已有 `StateConnecting`，协议里的 `network` 也允许 `connecting`，因此非阻塞启动不需要改协议。
- macOS 设置页把协议版本写死为 `'2'`，真实值是 `1`；两端都没有共享的应用版本常量。

约束：Vela UI 不使用截图或视觉基线验收；桌面与 iOS 的密度不同，atoms 不合并，只对齐结构、语义和文案。

## Goals / Non-Goals

**Goals:**

- 同一信息只出现一次；两端账户页、设置页、日志页、设备页的信息架构与词表一致。
- iOS 首屏在节点启动期间立即可用，显示「连接中」，连上后自动补齐。
- 应用版本与协议版各只有一个真源。

**Non-Goals:**

- 不合并两端的 atoms，不追求像素级一致。
- 不修改控制协议 v1、配置结构或数据目录。
- 不改变 iOS 的只读能力边界（不共享本机、不探测本地服务）。
- 不引入截图或视觉回归测试。

## Decisions

### D1 账户页采用 A 方案：两端身份头，信息各出现一次

```text
[Avatar]  账户名
私人连接     状态 | Tailnet
这台 Mac/iPhone 的身份   设备名称 | MagicDNS | 地址
登录 / 开发签名（仅 iOS） / 注销
```

- 账户名只在身份头出现；「私人连接」不再有「账户」行。
- 连接状态只在「私人连接」出现；身份头不再有状态 chip。
- 设备身份区块在「私人连接」之后，与 macOS 现有顺序一致；iOS 把该区块上移一位。
- 重新检查/注销的入口保留各平台现有位置（macOS 在「登录」区块，iOS 在工具栏与页尾），本次不改动作布局。

### D2 词表

| 概念 | 统一用词 | 替换 |
|---|---|---|
| Vela 的连接与状态 | 私人连接 | iOS 的「私人网络」（区块、登录按钮、重命名说明、设备页文案、状态提示） |
| 网络与设备集合 | Tailnet | 「私人网络中的设备」→「Tailnet 中的设备」；「从私人网络中选择」→「从 Tailnet 中选择」 |
| 远端设备 | 设备 | 「其他 Mac」→「其他设备」；「添加 Mac」→「添加设备」；「还没有添加其他 Mac」→「还没有添加其他设备」 |

错误提示里泛指网络时使用「同一 Tailnet」，避免又回到「私人网络」。

### D3 macOS 新增四个桌面 atom

| Atom | 用途 | 结构 |
|---|---|---|
| `Avatar` | 身份头 | 圆形；首字母；可选远程图片；`Image` 加载失败保留首字母 |
| `IconTile` | 设备行 | 圆角方块 + SF Symbol，尺寸按桌面行高 |
| `Dot` | 列表行状态 | 8pt 实心圆，颜色取自状态 token |
| `Segmented` | 外观、日志级别 | 一行等宽按钮；单一选中；键盘可达 |

四个 atom 只服务 macOS，不放进 `shared/ui`；`macos/ui/tests/desktop-layout.test.mjs` 增加结构与可访问性断言。

### D4 版本与协议真源

- `shared/ui/version.ts` 导出 `APP_VERSION`；两端「关于」使用它。
- 新增测试：读取两个 `nsh.json` 的 `version`，与 `APP_VERSION` 比较，任何一处漂移即失败。
- 协议版本通过 `CoreBridge.protocolVersion()` 获取；macOS client 补这个方法（Rust 模块已暴露），store 暴露派生值，删除 `'2'`。
- 诊断复制与摘要都使用这个派生值，不再各自维护常量。

### D5 启动不阻塞

```text
iOS 启动
  store.start()
    └─ core.start()            C ABI 立即返回，节点在后台启动
    └─ load()
         └─ status.get  ──►  vela.Status
                                节点 Running? 否 ──► 返回 network=connecting（不阻塞）
                                节点 Running? 是 ──► 读 LocalAPI，返回完整快照
  UI 立即渲染「连接中」
  schedule() 每 2s 轮询 ──► 连接后返回 connected
        └─ load() 触发 refreshRemotes()（首次连接立即刷新）
        └─ 设备与服务出现，无需手动刷新
```

实现要点：

- `network.Embedded` 增加 `StartAsync()`、`Running()`、`Starting()`；`Start()` 仍是唯一的同步启动入口，供 `LocalClient()` 等动作路径使用。
- `inner/core` 的状态读取先探测：实现异步启动接口的节点，未运行时直接返回 `StateConnecting`；不实现该接口的测试假节点保持原路径。
- `remoteAddresses` 在节点未运行时跳过 LocalAPI，返回空地址，避免间接阻塞。
- 协议里的 `connecting` 已存在，UI 的 `connectionLabel` 已映射为「连接中」，无需改协议或共享类型。
- 启动失败时状态落到 `offline`，UI 显示重试，不会停在「连接中」。

### D6 签名有效期文案

`ios/ui/core/signing.ts` 提供纯函数，输入到期时间与当前时间，输出说明文字：

| 条件 | 文案 |
|---|---|
| 无法解析/未嵌入 | 未读取到签名信息；覆盖安装不会清除设备身份与数据 |
| 已过期 | 签名已过期，请重新构建并覆盖安装 |
| 剩余 ≤ 7 天 | 还有 N 天到期，到期前覆盖安装即可 |
| 剩余 > 7 天 | 覆盖安装不会清除设备身份与数据 |

单测覆盖四种分支，使用固定时间，不依赖真实时钟。

### D7 设置页信息架构

| 区块 | macOS | iOS |
|---|---|---|
| 外观 | Segmented（跟随系统/浅色/深色） | Segmented（同文案） |
| 共享 | 共享这台 Mac | — |
| 通用 | 关闭窗口的行为说明 | — |
| 隐私 | Gravatar 开关 | Gravatar 开关 |
| 诊断 | 详细日志、性能 HUD、复制诊断 + 摘要 | 详细日志、复制诊断 + 摘要 |
| 关于 | 版本、控制协议 | 版本、控制协议 |

「复制诊断」在两端都是区块内的一行/一个动作，摘要行沿用现有投影。

### D8 日志页

- 两端都用 `Segmented`：全部/错误/警告/信息，标签带计数。
- 动作统一为「刷新」与「复制日志」；没有日志行时复制不可用。
- 空态区分「暂无日志」与「该级别没有记录」。
- 桌面继续使用固定时间列的 `LogList`；iOS 保留触控密度的行，只统一模型与文案。

### D9 设备行与术语

- 行结构：`IconTile` + 设备名 + 「状态 · N 个服务」+ `Dot`；`onPress` 打开详情。
- 地址从列表行移除，详情页增加设备身份区块（MagicDNS、地址），离线设备也可进入。
- 列表标题「其他设备」、空态「还没有添加其他设备」、动作「添加设备」；iOS 的「Mac」区块同步改名。
- macOS 现有行内 `Badge` 与多行地址移除；相关结构断言改写为新结构。

### D10 头像与 Core

- macOS 入口给 `vela.Options` 传 `Avatar: true`，`status` 在 Gravatar 开启时返回 `avatarUrl`；默认关闭，金测试的键集合不变。
- 两端头像使用同一投影（首字母来自 `userInitial`），macOS 用新 `Avatar` atom 渲染。
- Gravatar 开关在两端设置页出现；关闭时只显示首字母。

## Risks / Trade-offs

| 风险 | 对策 |
|---|---|
| macOS 远程头像加载失败或闪烁 | `Avatar` 始终先渲染首字母，图片加载成功后覆盖；失败保持首字母 |
| 非阻塞状态导致短暂「连接中」 | 这是预期状态；`connecting` 已有文案；启动失败落 offline 并可重试 |
| 非阻塞改动影响 macOS 的惰性启动 | `StartAsync` 在第一次状态读取时触发；动作路径仍用同步 `Start` |
| 词表替换波及大量文案与断言 | 先加文案清单测试，再逐页替换；结构断言同步更新，避免空断言 |
| 结构测试依赖源码文本 | 新增 atom 的断言按结构（导出、使用点）编写；行为用单测覆盖 |
| 两端控件看似一致但密度不同 | 只统一语义、标签与选中表达；尺寸与内边距各自使用平台 token |

## Migration Plan

| 阶段 | 内容 | 验收 |
|---|---|---|
| 1 | 版本常量与测试；macOS 关于/协议号 | 版本一致性测试、`verify` |
| 2 | 非阻塞启动（Go + iOS store） | Go 状态测试、iOS 结构测试、`verify` |
| 3 | 签名文案 | 单测覆盖四种分支 |
| 4 | 账户页（A） | 两端结构测试、手动检查区块顺序 |
| 5 | macOS atoms | atom 结构/可访问性断言 |
| 6 | 设置页统一 | 两端结构测试、Gravatar 切换 |
| 7 | 日志页统一 | 分段过滤与空态测试 |
| 8 | 设备页统一 | 行结构与术语断言、离线详情 |
| 9 | 集成 | `verify:release`、两端构建、iOS 真机覆盖安装 |

每个阶段独立提交，可单独回退；Core 改动与 UI 改动分开提交。

## Open Questions

- 无。macOS 的远程头像依赖 NSH `Image`（跨平台组件），若某一版 NSH 不支持远程 URL，按风险表保留首字母回退，不改变方案。
