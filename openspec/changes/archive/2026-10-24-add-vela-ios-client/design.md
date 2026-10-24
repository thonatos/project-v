# Design

## Context

动机与范围见 `proposal.md`。这里只记录塑造方案的事实与约束。

macOS 版已完成并归档（`add-vela-macos-app`）。它留下的、可被 iOS 直接消费的合约是：

- 远端 Vela 在私人网络上暴露 `control :47844`、`opencode :47845`、`dsh :47846`（按服务递增）；
- 清单为版本化 JSON（当前 v2），只含平台无关字段；
- 入站连接按私人网络身份做 WhoIs 授权，默认同用户放行；
- `adapters.isLoopbackAuthority` 已接受 `127.0.0.1`，`DSH` 会把 loopback authority 归一为 `127.0.0.1:3080`；
- 代理层是纯字节流（`tunnel`），不区分 HTTP/SSE/WebSocket。

因此 iOS 端不需要 Mac 侧任何改动，只需成为一个新的 Dial 方。

已核对的 NSH 侧事实（对照 crates.io `0.1.1` 与 `0.2.0` 源码）：

- `nsh-platform-ios` 提供 `AppView::new(mtm, frame, SurfaceOptions)`、`register_component`、`load(Bundle)`、`run(Root)`、`connect_dev_server`，且 0.1.1 与 0.2.0 签名一致；
- `run_app`（独立 App 路径）使用 `SurfaceOptions::default()`，`components` 为空；官方文档也明确打包 App 不注册原生组件；
- `nsh init --rust` 为 iOS 生成的是“TSX 入口 + Rust crate 作为 native module”，`src/main.rs` 只覆盖桌面平台；
- 内建 `<WebView>` 元素不暴露 `WKWebsiteDataStore`、`isInspectable` 或请求钩子。

其它约束：

- 目标设备为 iOS 26；运行基线定为 iOS 17（`WKWebsiteDataStore(forIdentifier:)`、`isInspectable` 的下限）。
- 仅 iPhone；iPad 只要求兼容运行。
- 分发使用自用开发签名（免费个人团队），证书 7 天有效。
- 两台 Mac 常开 OpenCode，同名服务的 Cookie 冲突是常态而非边界情况。

## Goals / Non-Goals

**Goals:**

- 构建一个前台可用的 iOS 访问客户端，Mac 侧零改动。
- 让两台设备上的同名服务同时保持独立登录态。
- 让内嵌页面可被 Mac Safari 检视（Web Inspector），否则排障成本不可接受。
- 让免费签名下的“每周重装”不丢身份、不需要重新登录 OpenCode。
- 与 macOS 共享协议、视图模型与代理实现，避免两份逻辑漂移。

**Non-Goals:**

- 后台、锁屏或通知触发的访问能力（需要服务端推送或网络扩展，成本与产品定位都不成立）。
- 在 iOS 上共享本机服务、发布监听端口。
- TCP 服务（`ssh`、数据库、Redis）的访问入口。
- iPad 专门布局、多标签浏览、App Store 审核路径、自动更新。

## Decisions

### 1. 采用 NSH 嵌入模式，而不是 `nsh package` 独立 App

`nsh package` 产出的独立 App 走 `run_app`，而它在构造 `SurfaceOptions` 时使用 `..SurfaceOptions::default()`，`components` 为空。这直接排除三件本方案必需的能力：

| 能力 | packaged | embed |
|---|---|---|
| 自定义 WKWebView（data store / inspector / ATS 控制） | 不可 | 可 |
| 生命周期钩子（前后台、退出） | 只能从 Rust 侧挂通知 | 宿主直接持有 |
| `nsh dev` 热重载 | 不可 | `connect_dev_server` |

替代方案是“packaged + 内置 `<WebView>` + hostname 隔离 + 后处理 Info.plist”。它要求在 `.localhost` 解析、ATS 对非 loopback 主机的策略、以及构建产物重签名三处同时押注，而任何一处失败都要回到 embed。既然已经确认两台 Mac 常开同名服务、Cookie 隔离是硬需求，直接选 embed。

代价是自建 iOS 宿主：复制 NSH `nsh-platform-ios/src/app.rs` 的 bootstrap（约 250 行，Apache-2.0，加归属说明），把 `SurfaceOptions` 换成带 `components` 的版本，并在其中启动 Go Core、接 scene 生命周期。这也与 macOS 的既有决策一致：应用生命周期属于宿主，不属于页面。

### 2. 三层边界：Swift 薄壳 / Rust 宿主 / Go 静态库

```text
+-------------------------------------------------------------+
| Vela.app  (Xcode target: io.implements.vela.ios)              |
|                                                             |
|  main.swift  ->  vela_ios_main()   (C ABI)                   |
|                        |                                     |
|  +---------------------v----------------------------------+  |
|  | libvela_ios.a  (Rust staticlib: vela-ios-native)       |  |
|  |  bootstrap: UIApplicationMain + AppView + components   |  |
|  |  #[native_module("vela/native")] CoreBridge            |  |
|  |  native component "vela/webview"                       |  |
|  |  scene phase -> core start/suspend/resume/stop         |  |
|  +-------------------------+------------------------------+  |
|                            |  C ABI (//export)                |
|  +-------------------------v------------------------------+  |
|  | VelaCore.xcframework  (Go, -buildmode=c-archive)        |  |
|  |  tsnet userspace node (Dial only)                       |  |
|  |  mappings (loopback listener) + tunnel + adapters       |  |
|  |  manifest client + config + control (io.Pipe)           |  |
|  +-------------------------+------------------------------+  |
+----------------------------|--------------------------------+
                             |  tsnet.Dial(100.x:47845)
                             v
                   Mac mini / Studio
```

Swift 只保留 `main.swift`、`Info.plist`、entitlements 与资源；所有逻辑在 Rust 与 Go。这样做的理由是 ABI 最少：Swift 只调用一个 C 函数，避免把 Go 的接口同时暴露给 Swift 和 Rust。

### 3. Go Core 以 Dial-only 变体内嵌

新增 `core/mobile`（`package main` + `//export`），作为 c-archive 入口，import 现有 `internal` 包：

| 包 | iOS |
|---|---|
| `network` | 复用，只用 `Dial` / `LocalClient` |
| `mappings` | 复用，loopback listener + 稳定端口 |
| `tunnel` | 原样 |
| `adapters` | 原样 |
| `manifest` + `remoteclient` | 原样 |
| `config` + `paths` | 复用，写入 App 容器 |
| `diagnostics` | 复用（脱敏） |
| `control` | 复用协议与 `Server`，传输改为 `io.Pipe` |
| `publication` / `sharing` / `inbound` / `authorization` / `services` | 不参与编译 |

控制协议保持与 macOS 同一套 JSON Lines，因为它是现有设计里唯一的宿主/Core 边界（design §7）。iOS 上把 `os.Stdin/Stdout` 换成一对 `io.Pipe`，Rust 侧写请求、读响应与事件；`CoreBridge` 的 TSX 接口因此与 macOS 完全相同，`ui/core/client.ts` 可复用。

Go 静态库通过 `GOOS=ios GOARCH=arm64 CC=<clang wrapper> go build -buildmode=c-archive` 产出（`libtailscale` 上游 Makefile 已有同样的 iOS 目标，可作为参照）。Rust `vela-ios-native` 用 `extern "C"` 声明这组函数，编译期由 Xcode 的链接阶段合并。

风险点是“Rust staticlib + Go c-archive 同时进入一个 iOS 二进制”。替代方案是 `gomobile bind` 直接生成 Objective-C framework，由 Swift 调用；但那会把 Go 暴露给 Swift，并失去与 Rust native module 的直连，反而增加一层。先用 c-archive，S1 验证；失败再切 gomobile。

### 4. 内嵌 WKWebView，按“设备 + 服务”分配独立数据存储

macOS 选择系统浏览器、明确放弃 WebView（design §5）。iOS 必须做出相反选择，但原因不是偏好：

```text
系统浏览器路径在 iOS 上不成立：
  Vela -> 拉起 Safari -> Vela 进入后台 -> iOS 挂起进程
                                     -> loopback listener 停止
                                     -> Safari 连接失败
```

WebView 与 App 生命周期天然对齐：前台 = 隧道活跃 = 代理活跃。副产品是 macOS 上“窗口隐藏后网络可靠性”那整类风险在 iOS 上消失。

隔离方案对比：

| 方案 | 隔离维度 | 判定 |
|---|---|---|
| `<service>-<device>.localhost` | 主机名 | 依赖 ATS 对 `.localhost` 的豁免与 WebKit 子域解析，旧版本有已知缺陷 |
| `127.0.0.<n>` | 主机名 | 依赖 lo0 允许绑定 `/8` 别名；ATS 仍需例外 |
| **每服务 `WKWebsiteDataStore(forIdentifier:)`** | 数据存储 | 无主机名依赖，URL 可统一为 `http://127.0.0.1:<port>` |

采用第三种。URL 回到 `127.0.0.1` 后，`adapters.isLoopbackAuthority` 直接命中，DSH 归一逻辑无需修改；`localStorage` 按 origin（含端口）天然隔离，Cookie 由 store 隔离。

自定义原生组件 `vela/webview` 需要暴露：`source`、`dataKey`（设备+服务标识）、`reload` 命令、`onLoad`/`onError`/`onNavigationStateChange` 事件，并在 Debug 构建设置 `isInspectable = true`。

ATS 例外由我们自己的 `Info.plist` 提供（这是选 embed 的又一个理由）：`NSAllowsLocalNetworking` 加 `NSExceptionDomains` 中的 `127.0.0.1`，避免在 iOS 17+ 上被默认策略拦截。

### 5. 生命周期是会话，不是常驻

```text
        scenePhase
  inactive --(background)--> suspended --(active)--> connecting --> active
     ^                            |                                  |
     |                            +----(terminate)--> stopped        |
     +----------------------------------(inactive)-------------------+

active      : tsnet started, mappings listening, WebView alive
suspended   : mappings closed (ports released), tsnet state kept, context kept
connecting  : rebuild mappings, reload current service if needed
stopped     : core.Close()
```

`start` 必须幂等且快（周更重装后频繁冷启动）。macOS 的“父进程 EOF 自退出”在 iOS 上不适用，改为显式 `stop`。

### 6. 导航是“盖”，不是“推”

WebView 是页面状态的持有者，push/pop 会销毁它。因此：

```text
服务列表 : Sheet 覆盖在舞台之上（或从舞台底部拉起）
舞台     : 常驻，切换服务时替换 source，不卸载组件树
设置/设备: Sheet
```

整个 App 只有舞台是“页面”，其余都是覆盖层。这样“返回列表”不丢终端滚动位置与输入草稿，切服务才发生重载。

### 7. 仓库布局与共享边界

放在现有 `packages/apps/vela` 内，而不是新建 app 包：

```text
packages/apps/vela/
  core/                  # 唯一 Go module
    mobile/              # 新增 c-archive 入口
  Cargo.toml             # workspace += ios-native
  host/                  # macOS Rust 宿主（不变）
  ios/                   # 新增：Xcode 工程 + Swift 薄壳 + Rust crate
  ui/                    # macOS TSX（不变）
  ui-shared/             # 新增：协议类型、视图模型、RPC 信封（纯 TS，无 JSX）
  ui-ios/                # 新增：TSX 入口与移动端原子层
  scripts/               # build-ios-core.sh / build-ios.sh
```

理由：Go 只能有一个 module（否则 `tailscale.com` 依赖图翻倍）；Cargo 版本锁定必须单点；`nsh build` 跟随 workspace 内包解析未经验证，同包相对导入是确定可用的。

共享边界：`protocol`、`view-model`、RPC 信封共享；原子层与 store 流程不共享——iOS 没有 sharing/forwards/rename，重写约 150 行比抽象更省。

### 8. 签名与每周重装

免费个人团队意味着证书 7 天有效、需要 Xcode 自动签名。设计上的应对：

- bundle id 固定为 `io.implements.vela.ios`，永远覆盖安装，禁止删除 App；
- tsnet 状态写入 App 容器（`Application Support/vela/network`），重装不清；
- 设置页显示 `embedded.mobileprovision` 的到期时间与当前节点身份；
- 远程授权依赖“同用户登录”而非设备白名单，避免重装产生新节点后需要改 Mac 配置；
- Xcode 工程而非 `nsh package --profile`，因为证书续签本来就需要 Xcode 参与。

### 9. 与 NSH 0.2.0 的关系

宿主 API 在 0.1.1 与 0.2.0 之间未变，因此本设计对两者都成立。但 0.2.0 的 `nsh-base` 提供 `Switch`、`RadioGroup`、`Sheet`、`Tabs`、`ContextMenu`，正好覆盖 iOS 原子层所需；0.1.1 的 `nsh-ui-mobile` 没有 `Switch`。计划顺序是：先完成 `upgrade-nsh-to-0-2-0`，再实现本变更。若升级延后，iOS 原子层需要先自绘一个开关组件，属可接受的降级。

## Sequence Diagrams

### 打开远端服务

```text
User      TSX(ui-ios)   Rust host    Go Core     Local WKWebView   Remote Vela
 |            |             |            |               |              |
 | tap svc    |             |            |               |              |
 |----------->| map.open    |            |               |              |
 |            |------------>| ---------->|               |              |
 |            |             |            | dial 100.x    |              |
 |            |             |            |----------------------------->|
 |            |             |            | ok            |              |
 |            |             |<- url -----|               |              |
 |            | load http://127.0.0.1:p |               |              |
 |            |------------------------------------------------------->|
 |            |             |            |   bytes <-> tsnet stream     |
```

### 进入后台与返回

```text
iOS        Rust host        Go Core              WKWebView
 |             |                |                     |
 | background  |                |                     |
 |------------>| suspend        |                     |
 |             |--------------->| close mappings      |
 |             |                | keep tsnet state    |
 |             |                |                     | (page kept)
 | active      |                |                     |
 |------------>| resume         |                     |
 |             |--------------->| reopen mappings     |
 |             |<-- url ---------|                     |
 |             | reload if needed ------------------->|
```

### 首次认证

```text
User   TSX      Rust host      Go Core        ASWebAuthenticationSession   Control Plane
 |      |           |             |                      |                     |
 | sign |           |             |                      |                     |
 | in   |---------->| auth.start  |                      |                     |
 |      |           |------------>| login URL            |                     |
 |      |           |<------------|                      |                     |
 |      |           | open ----------------------------------------------->   |
 |      |           |             |  poll                |                     |
 |      |           |             |<-------------------------------------------|
 |      |           |  connected event                     |                     |
 |      |<----------|<------------|                      |                     |
```

认证用 `ASWebAuthenticationSession` 而不是跳出到 Safari：后者会让 App 进入后台，tsnet 的登录轮询随之中断。

## Risks / Trade-offs

- [Rust staticlib 与 Go c-archive 同二进制可能符号冲突] → S1 用最小工程验证；失败改用 `gomobile bind` 生成 framework。
- [`nsh-platform-ios` 0.1.1/0.2.0 在自建 bootstrap 下渲染 TSX bundle 行为未验证] → S2 以最小 TSX 页面验证；必要时只在宿主内使用 `AppView` 的公开 API，不改 NSH 源码。
- [内嵌 WebView 无浏览器扩展、无书签、无下载管理] → 接受；下载由服务端提供的链接交给系统分享面板。
- [WKWebView 中 Passkey / 自动填充能力不确定] → 以 OpenCode 配对流程为验收用例；若 Passkey 不可用，记录为已知限制并提示使用 token 方式。
- [免费证书 7 天过期导致 App 无法启动] → 固定 bundle id、显示到期时间、提供一键重装脚本；长期可升级付费账号，不影响设计。
- [iOS 前台才可用，用户可能在切换应用后丢失会话] → 明确的 suspended 状态与“返回后重连”反馈，不伪装后台可用。
- [复制 NSH bootstrap 带来上游漂移] → 只复制 `app.rs` 的最小部分，升级 NSH 时对照 diff；在文件头注明来源与许可证。

## Migration Plan

1. 完成 `upgrade-nsh-to-0-2-0` 并让 macOS 回归全绿（本变更的前置）。
2. S1：模拟器验证 Go + Rust FFI + TSX 调用链。
3. S2：Xcode embed 骨架在真机跑通，验证自动签名与 7 天重装。
4. S3：WebView、data store 隔离、ATS、OpenCode/DSH 契约。
5. S4–S6：Go iOS Core、TSX UI、契约测试与打包脚本。

回滚：删除 `ios/`、`ui-ios/`、`core/mobile/` 并从 workspace 移除成员即可；macOS 与 Mac 端 Vela 不受影响。iOS 节点可从 tailnet 移除。

## Open Questions

- iPad 上是否需要一个最小可用的双栏布局（当前只要求兼容运行）。
- 是否为 iOS 增加“最近使用服务”的本地快捷入口（不影响协议与架构）。

## S1 / S3 Go-No-Go 记录

### S1：Rust staticlib 与 Go c-archive 同二进制

**结论：Go（模拟器已验证，真机待签名验证）。**

- `scripts/build-ios-core.sh` 产出 `ios-arm64` 与 `ios-arm64-simulator` 两个 Go slice；`lipo` 分别报告 `arm64`，由 XCFramework 承载（两者同为 arm64，不能合成 fat archive）。
- `cargo build --target aarch64-apple-ios-sim -p vela-ios-native` 产出 Rust staticlib，导出 `vela_ios_main`；Go archive 导出 `vela_core_*`。
- `xcodebuild -sdk iphonesimulator` 链接两者成功，模拟器安装启动：窗口出现、`vela_core_start` 返回、tsnet 进入 `NeedsLogin`、控制循环启动。
- 真机 slice 同样完成编译，但本环境没有可用真机与开发团队，链接与启动留给真机签名验证；目前不需要切换到 `gomobile bind`。

### S3：WKWebsiteDataStore 隔离

**结论：Go（真机验证通过，不启用 `127.0.0.<n>` 回退）。**

- `vela/webview` 以 `dataKey`（设备私人名称 + 服务 ID）经 `uuid_for` 算出确定性 UUID，交给 `WKWebsiteDataStore(forIdentifier:)`。同一 key 在重启与覆盖安装后得到同一个 UUID，不同 key 必然不同；UUID 不可构造时退回随机 UUID，不共享默认存储。
- 真机数据容器 `Library/WebKit/WebsiteDataStore/` 下并存 5 个独立存储目录，各自带独立的 `Cookies/Cookies.binarycookies` 与 `Origins/<hash>/LocalStorage/localstorage.sqlite3`；10/23 建立的存储到 10/24 仍在被继续写入，隔离在 App 重启后保持。
- 两台 Mac（`vela-macmini` / `vela-macstudio`）的同名 OpenCode 因此落在不同 data store，登录态互不覆盖，满足 spec「按设备与服务隔离的会话」。
- URL 仍统一为 `http://127.0.0.1:<port>`，不依赖主机名别名，也不需要 ATS 对 `.localhost` 子域的额外豁免。
- 未采用的替代方案：`127.0.0.<n>` 主机名别名。若日后 WebKit 的数据存储隔离出现回归，只需替换 `vela/webview` 的 `source` 主机，Go 的 `adapters` 逻辑无需改动。

## iOS 界面（重做版）

完整的页面清单、功能对照、间距表、ASCII 页面与操作流程见 [`ui-audit.md`](./ui-audit.md)。

审计结论的优先级：

1. **先定规范，再改界面**：间距/尺寸、状态映射与数据投影必须先成为单一来源，否则每加一个页面都会重新分叉。
2. **轻量浏览器结构保留**：导航栏（头像 / 返回 / 标题 / 更多）+ 内容区；服务列表是根页面，服务是 WebView 舞台；用户与设置是两个独立 modal。
3. **与 macOS 统一的是数据与管理语义，不是布局**：账户字段、设备字段、状态文案、日志筛选/诊断复制对齐 macOS；共享、服务编辑、转发列表、TCP、性能 HUD 明确不进入 iOS。
4. **Modal 是有栈的**：设备列表 → 设备详情关闭回设备列表；从设备列表添加设备成功后回设备列表；从更多进入设置/日志关闭回根（单层）。
5. **页面保留**：从舞台返回根列表不关闭 mapping、不卸载 WebView；再次进入同一服务不重载，切换服务才重建。
6. **浏览器使用固定的真实可视矩形**：`WKWebView` 顶边为容器顶边 + 63pt，常态底边为容器底边 - 84pt，两者按 3:4 配比。84pt = 52pt 工具栏 + 20pt 浮起距离 + 12pt 工具栏上方留白，使工具栏在页面背景中保持上下 padding。工具栏收起只改变外观，不改变 WebView 边界或网页 viewport。
7. **键盘只由 `UIKeyboardLayoutGuide` 驱动**：常态底边约束优先级为 999，同时以必需约束限制 WebView 底边不得低于 `UIKeyboardLayoutGuide.topAnchor`；键盘弹出时 UIKit 自动缩短真实视图，关闭时自动恢复。宿主禁止监听键盘通知、手动修改 WebView frame、`obscuredContentInsets`、`contentInset`、`contentOffset` 或注入 `visualViewport`/DOM 位移补偿。此前这些方案会在 iOS 26 上使布局视口与视觉视口失步，表现为页面整体上移、状态栏遮挡和底部大块空白。
8. **浏览器外沿使用 WebKit 语义主题色**：顶部 63pt 与底部 84pt 属于 `vela/webview` 的全屏 container，不属于内部 `WKWebView`。页面主题变化时原生读取 `WKWebView.themeColor` 并设置 container 背景，未声明时回退 `underPageBackgroundColor`、再回退系统画布；同一颜色的亮度决定状态栏文字。禁止通过截图、DOM 遍历或 CSS 像素取色，页面只发送无颜色值的 `themeSync` 通知。
9. **映射生命周期不继承控制请求 context**：打开或恢复映射的请求 context 只约束建立阶段，长期代理监听仅由 `Close`、`CloseAll` 与 iOS `Suspend` 管理。前台恢复分两阶段：`WillEnterForeground` 同步重建映射，`DidBecomeActive` 再通过当前 WebView 的 Objective-C 弱引用直接 `reload`；该路径不得进入 NSH store、signal 或布局树。

以下决策待产品确认后再落实现：

- 列表采用“卡片内嵌”还是 iOS 设置式整行；
- Sheet body 是否统一为无横向 padding、由行自带 16pt；
- 0 服务设备是否保留分组头；
- 日志是否做完整筛选/计数/摘要；
- 更多菜单高度是否内容驱动（最大 60%）；
- 是否增加“关闭当前服务”入口；
- 复制诊断是否需要轻提示。

已按重做版规范实现：系统控件（SF Symbols、UISwitch、UISegmentedControl、action sheet、page sheet）、inset-grouped 列表、模态栈。
