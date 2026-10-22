# Design

## Context

参见 `proposal.md` 的动机与范围。当前仓库没有 Vela 实现；这是一个独立的新 macOS 产品面。家中 Mac mini 已常驻运行 OpenCode V2 Web 与 DSH Web，Vela 不负责这些进程的生命周期。

关键约束如下：

- OpenCode V2 默认监听 `127.0.0.1:49374`，具备配对、Cookie、事件流和 PTY WebSocket。
- DSH 默认监听 `127.0.0.1:3080`，使用 token/Cookie，并校验 Host、Origin 与可信 authority。
- Vela 不得创建系统 VPN、修改代理、DNS 或路由；私人网络只服务 Vela 自身流量。
- NSH 的 TSX 层适合界面，但不能直接承载 TCP listener、进程监督或 `tsnet`；用户的系统浏览器访问 Vela 在 loopback 上提供的本地映射。
- NSH 标准 macOS runner 支持原生界面，但 Vela 需要自定义 Rust 宿主来持有应用级生命周期、设置 `keep_alive_on_close`、桥接 Core 并组装辅助二进制。
- `tsnet` 是 Go 原生的稳定嵌入路径；同一个 node 可以同时监听远端连接和拨号访问其他 Vela Mac。

## Goals / Non-Goals

**Goals:**

- 形成一个 `Vela.app`，每台 Mac 无需选择模式即可同时共享本机和访问远端。
- 将网络核心与 UI 解耦，使窗口重载、关闭或暂时不可见不影响共享和连接。
- 对 OpenCode V2 与 DSH 提供透明、长连接友好的 Web 访问。
- 提供可测试的控制协议、服务清单和退出清理边界，为未来 iOS 客户端保留平台无关的 Host 合约。
- 让界面符合 macOS 原生交互，避免呈现 VPN 管理台或通用代理配置器。

**Non-Goals:**

- 不实现任意 TCP/UDP 端口共享、子网路由、出口节点或公网 Funnel。
- 不启动、停止、更新或配置 OpenCode V2 与 DSH。
- 不在首版实现 iOS 客户端、自动 peer 发现、菜单栏状态项、浏览器式多标签或自动更新。
- 不移除或替代 OpenCode V2 与 DSH 自身认证。
- 不承诺 Mac 系统睡眠期间可访问，也不由 Vela 修改电源策略。

## Decisions

### 1. 使用单一应用和能力并存模型

每个 `Vela.app` 都运行同一套 Core。Core 中共享能力和访问能力可以独立启停，但不是互斥模式：

```text
+-----------------------------+
| Vela.app                    |
|                             |
| Access remote Macs   always |
| Share this Mac       on/off |
+-----------------------------+
```

UI 使用“这台 Mac”“我的 Mac”“共享服务”“打开”等用户概念。内部可以使用 host/client 命名，但不得将其作为首次选择或全局模式。

替代方案是拆分 Host 与 Client 两个 App。该方案会增加安装、身份和生命周期心智，并阻止一台 Mac 自然同时承担两种能力，因此不采用。

### 2. 采用 NSH TSX UI、自定义 Rust macOS 宿主和 Go Core helper

进程边界如下：

```text
+---------------------------------------------------+
| Vela.app                                          |
|                                                   |
| +---------------- NSH TSX ----------------------+ |
| | device UI / settings / forwards / logs       | |
| +---------------------+-------------------------+ |
|                       | typed native module       |
| +---------------------v-------------------------+ |
| | Rust macOS host                              | |
| | AppKit lifecycle / NSH AppView / Core bridge | |
| +---------------------+-------------------------+ |
|                       | JSON Lines over pipes     |
| +---------------------v-------------------------+ |
| | Contents/Helpers/vela-core                    | |
| | Go + tsnet + proxy + health + persistence     | |
| +-----------------------------------------------+ |
+---------------------------------------------------+
```

职责分配：

- NSH TSX：可见界面、界面导航、视觉状态、转发列表和设置表单。
- Rust 宿主：应用与窗口生命周期、Core 进程监督、NSH native module、菜单、Dock 恢复和退出清理。
- Go Core：一个 `tsnet` node、身份状态、服务探测、远端 listener、本地映射、透明字节代理、远端清单和授权。

采用 helper 而不是把 `libtailscale` 静态链接进 Rust，可保持 `tsnet` 的原生 Go API，降低 Rust/C/Go 同进程链接和崩溃隔离复杂度。采用 helper 而不是调用系统 Tailscale，可满足不安装 daemon、不改变全局网络的要求。

### 3. 一个持久化 tsnet node 同时 Listen 与 Dial

每个 Vela 安装拥有一个持久化私人网络身份，状态目录位于：

```text
~/Library/Application Support/Vela/network/
```

同一 node：

- 为本机共享能力监听 Vela 控制端口和已启用服务端口；
- 为远程访问能力拨号其他 Vela node；
- 不运行 exit node，不发布 subnet route，不创建 TUN。

首版使用交互认证。Core 将认证 URL 作为事件交给 Rust 宿主，由系统浏览器打开。应用包不包含长期 auth key。

### 4. 使用固定的 Vela Host 合约与版本化清单

每台共享中的 Vela 暴露以下 tailnet-only 入口：

```text
control :47844  -> Vela control HTTP
opencode:47845  -> 127.0.0.1:49374
dsh     :47846  -> 127.0.0.1:3080
```

端口属于 tsnet 虚拟 node，不要求 macOS root 权限，也不暴露到 LAN。控制面提供最小版本化接口：

```text
GET /vela/v1/manifest
GET /vela/v1/health
```

清单只包含稳定、平台无关的数据：协议版本、设备显示名、服务 ID、显示名、端口、可用状态和共享状态。它不暴露本机 target，也不接受客户端传入代理目标。

Host 对控制面和服务入口的每个新连接执行私人网络身份查询，再应用本机 allowlist。首版授权默认可收敛为“与本机 node 属于同一用户”，但策略接口保留设备粒度扩展能力。

替代方案是 Tailscale Services。它需要 tagged identity、管理员审批和额外服务管理，超出个人多 Mac MVP。另一个替代方案是一个端口上的自定义多路复用协议；它会增加 framing、背压和连接恢复复杂度，首版使用每服务独立 TCP listener。

### 5. macOS 客户端通过 loopback 映射访问远端 Web

Vela 不内置 WebView。用户打开服务时，Core 创建本地 loopback listener，并把每条连接通过 `tsnet.Dial` 送到远端服务端口；用户在自己的系统浏览器中访问这个 loopback 地址：

```text
用户的系统浏览器
    |
    | http://<service>-<device>.localhost:<stable port>
    v
local Vela listener
    |
    | tsnet.Dial(remote:47845)
    v
remote Vela listener
    |
    v
127.0.0.1:49374 OpenCode
```

> 2026-10 决策：以系统浏览器取代内置 WebView，覆盖此前的持久 WebView 工作区与自定义 `WKWebView` native component 设计。理由是 Vela 的职责是建立转发链路，而浏览器在书签、密码管理、扩展、下载、开发者工具和多标签上都优于任何内嵌实现；移除 WebView 同时消除了一整类宿主侧生命周期与焦点问题。

这种方式让浏览器使用普通 loopback URL，保留 secure-context 语义，不修改系统代理，也可以透明承载 HTTP、SSE、WebSocket 和原始升级连接。代理层使用流式复制，不读取业务 payload，不对响应整体缓冲，并支持 TCP 半关闭和长空闲连接。

本地映射仅监听 IPv4/IPv6 loopback。映射地址必须按“设备 + 服务”稳定复用并持久化，否则每次重新打开服务都会丢失登录态。Core 为每个映射分配一次端口后写入配置，重启和重复打开都复用同一端口；端口被占用时才重新分配并更新记录。

映射地址必须使用按“设备 + 服务”派生的 `<service>-<device>.localhost` 主机名，而不是裸 `127.0.0.1`。原因是 Cookie 的作用域只看 host、不看端口：在共享的系统浏览器中，不同设备上的同名服务若都使用 `127.0.0.1`，Cookie 会互相覆盖。`*.localhost` 由 RFC 6761 保证解析到 loopback，无需修改 `/etc/hosts` 或安装任何系统组件，且保留 secure context。`localStorage` 按完整 origin（含端口）隔离，不受此问题影响。映射地址属于本机内部实现，不进入 Host 清单，也不作为跨设备协议。

### 6. 保持目标服务认证并最小化 authority 改写

改用系统浏览器改变了映射的暴露面，必须明确记录：内置 WebView 时映射只有 Vela 自己能访问，现在本机任何进程和任何浏览器扩展都能访问这个 loopback 地址。该暴露面与"在本机直接运行该服务"相同——被转发的 OpenCode 在源机上同样监听 `127.0.0.1:49374` 且本机进程可达；并且 OpenCode 配对、DSH token 等服务自身的认证全部保留。Vela 不因此放宽任何授权检查：跨设备方向仍需通过 Tailscale WhoIs 与本机 allowlist。

Vela 不代替 OpenCode V2 或 DSH 登录：

- OpenCode 配对路径通过本地映射打开，成功后 Cookie 留在对应 Web 数据域。
- DSH token URL 同样通过本地映射打开。
- Host 代理默认透明转发 Host、Origin、Set-Cookie 和 Upgrade 语义。
- 因浏览器实际 authority 是 Vela 的 `<service>-<device>.localhost` 映射，优先让后端看到一致的 loopback Host 与 Origin；若 DSH 版本仍拒绝，则界面展示需要加入的 Vela authority，不通过无条件删除 Origin 或伪造安全头绕过。

实现阶段必须以当前 OpenCode V2 和 DSH 版本进行契约测试，确认配对、Cookie、Host/Origin、SSE 和 WebSocket。任何针对单一产品的 header 兼容规则必须封装在对应服务 adapter 中，不能成为通用代理默认行为。

### 7. Core 控制协议使用带版本的 JSON Lines

Rust 宿主通过 Core 的 stdin/stdout 建立单主控通道，stderr 仅用于诊断日志。每行是一个有 `version`、`id`、`type` 的 JSON 对象：

```json
{"version":1,"id":"req-1","type":"status.get"}
{"version":1,"id":"req-1","type":"status","network":"connected"}
{"version":1,"type":"event.service","service":"opencode","available":true}
```

命令至少覆盖：

- 获取快照与订阅事件；
- 开始认证、重连和注销；
- 读取/更新共享设置；
- 刷新本机服务；
- 添加、移除和刷新远端 Mac；
- 打开、关闭服务映射；
- 请求优雅关闭。

Core 对未知版本或消息类型返回结构化错误。UI 不解析 Go 日志来推导状态。配置写入由 Core 串行完成并采用原子替换，避免 Rust 与 Go 同时写同一文件。

### 8. 应用生命周期属于 Rust 宿主而非 NSH 页面

Rust 宿主在应用启动时只启动一次 Core，并使用 NSH macOS `keep_alive_on_close: true`。窗口行为：

```text
red close / Cmd+W --> hide existing window
Dock activation   --> show existing window and current state
Cmd+Q / Quit      --> bounded graceful shutdown
```

NSH bundle reload 和页面切换不得停止 Core。Rust 宿主持有 macOS process activity，降低窗口隐藏后 App Nap 对常驻网络服务的影响，但不阻止整机睡眠。

Core 以控制管道 EOF 作为父进程异常退出信号并自行关闭。Core 意外崩溃时，Rust 宿主最多按有界指数退避重启；进入退出状态后禁止重启。

#### 正常退出时序

```text
User          Rust Host          Go Core          Remote Clients
 |                |                 |                    |
 | Cmd+Q          |                 |                    |
 |--------------->|                 |                    |
 |                | shutdown       |                    |
 |                |--------------->|                    |
 |                |                 | stop accepting     |
 |                |                 |------------------->|
 |                |                 | drain/close flows  |
 |                |                 | close tsnet        |
 |                | stopped        |                    |
 |                |<---------------|                    |
 |                | exit app       |                    |
```

退出有固定上限；超时后 Rust 终止自身 helper，避免应用无法退出。

### 9. UI 采用 PC 桌面控制台与单内容区模型

> 本节与第 10、11 节是 2026-10 PC UI 评审后的最新决策，覆盖此前的 Technical Cartography、228pt 设备侧栏、服务焦点模式、浏览器式工具栏和侧栏展开设计。

窗口是固定尺寸竖向工具窗 `480 x 960pt`：内容是单列数据行，缩放没有可展示的额外信息，因此移除 `Resizable` 并把内容最小与最大尺寸都钉在同一值；同时隐藏因此永久失效的最大化按钮，菜单也不提供缩放与全屏。主框架使用 NSH/macOS 系统默认标题栏（高度与窗口控件位置由系统决定，不可由应用调节）、`56pt` 固定窄图标导航和单一内容区。图标导航不支持展开，并自然位于系统标题栏下方。Vela 不自绘标题栏，也不实现自定义窗口拖动。

系统标题栏只显示应用窗口信息并承担原生拖动，不承载模块操作。设备详情、远端设备详情和服务详情必须使用同一个结构化详情页头：返回动作、对象标题、副标题和该对象的主要动作同处一行，并以分隔线与下方 section 区分；不得使用贴边工具条或第二层标题栏。低频动作（添加设备、修改名称、删除设备）位于详情页头或所属内容 section 的上下文菜单。

布局如下：

```text
+----------------------------------------------------------------+
| traffic lights                     object context when needed   |
+------+---------------------------------------------------------+
| dev  | This Mac                                               |
| svc  | +-----------------------------------------------------+ |
|      | | MacBook Pro        private name        Online      > | |
|      | +-----------------------------------------------------+ |
|      |                                                         |
| set  | Other devices (2)                         [ Add device ] |
|      | +-----------------------------------------------------+ |
|      | | Mac mini           private name        Online      > | |
|      | | Studio             private name        Offline     > | |
|      | +-----------------------------------------------------+ |
+------+---------------------------------------------------------+
```

视觉 token 使用 4pt 基线、明确的状态语义，并借用 shadcn/ui 的配对约定：每个表面色都必须有配套前景色，视图与组件不得出现十六进制字面量或半透明遮罩。借用的只是 token 结构与组件分层，不是 shadcn 的中性灰配色。

> 2026-10 决策：配色改为暖白纸面 + 单一赭色强调，覆盖此前的冷灰蓝与"深色侧栏"方案。前者三层灰白中侧栏与画布对比度仅 1.1:1，结构读不出来；后者在浅色模式下把导航反转为深色，导致侧栏内无 tint 的 `NSButton` 图标沿用系统深色标签色而几乎不可见——这是实测确认的缺陷，不是观感偏好。结论是导航必须留在画布色系内，靠一条发丝边框分层。

| 角色 | Light | Dark |
|---|---|---|
| Canvas / 页面 | `#F5F4F0` | `#1B1A18` |
| Surface / 内容 | `#FFFFFF` | `#242321` |
| Sidebar / 导航 | `#EFEDE7` | `#201F1D` |
| Subtle / 悬停与选中 | `#E8E5DD` | `#2E2C29` |
| Border / 分隔 | `#DDD9D0` | `#393631` |
| Text / 主文字 | `#1F1E1C` | `#F2F0EC` |
| Muted / 次文字 | `#6B6761` | `#A8A29A` |
| Accent / 链路活跃 | `#A8491F` | `#E08A5E` |
| Success / 转发中 | `#4F6B3F` | `#8FB97A` |
| Warning / 处理中 | `#8A6420` | `#D9A857` |
| Danger / 失败 | `#A63A2E` | `#E8796B` |
| Offline / 离线 | `#6F6A62` | `#9A948B` |

所有前景色在自身表面上均不低于 4.5:1，由 `ui/tests/theme.test.mjs` 直接从调色板计算断言，而不是比对硬编码列表；该测试同时断言导航与画布的色阶落在 1.03–1.6 之间，防止再次出现反转侧栏。

`Button` 是真实 `NSButton`，其 variant（`primary`/`outline`/`secondary`/`danger`/`plain`）映射到 AppKit bezel 与 tint，由 `colorWithName:dynamicProvider:` 让 AppKit 自行按外观解析，不使用系统 `controlAccentColor`。`plain` 必须显式指定 tint 而不是继承系统标签色，否则图标在非系统外观的表面上会失去对比。

字体使用系统 SF Pro Text 与 SF Mono。页面/对象标题 15pt semibold、section 标题和主要行文本 13pt、次要说明 12pt、地址与协议数据 11pt SF Mono；9pt 文本不得承担关键内容。

间距按 480pt 固定窗口标定：页面边距 16pt、section 间距 20pt、页头到列表 16pt、行内水平边距 16pt、垂直边距 6pt；数据行按内容定高，单行约 32pt、双行约 42pt。此前的 24pt 页面边距是按 1280pt 宽窗设定的，在 480pt 下占去 10% 宽度且使完整 IPv4+IPv6 地址（实测 388pt）无法容纳。此前的 56pt 最小行高让单行行（13pt 标题实际只占 16pt）近一半是空白；新的 32pt 下限只为容纳行尾 24pt 的小号开关。

PC 页面宽度统一：设备列表、设备详情、转发列表、日志和设置都由状态与操作分组构成，必须占满扣除固定导航和 24pt 页面边距后的可用宽度，不得使用居中窄内容列。空状态不得依赖滚动容器的内容高度，必须作为页面直接的 `flex-1` 子视图在内容区水平、垂直居中。

Vela 的定位是服务转发工具而非浏览器容器，因此窗口是固定尺寸竖向工具窗 `480×960`，不再锁定 16:9，也不可缩放。480pt 下内容宽度为 344pt（扣除 56pt 导航、48pt 页面边距、32pt 行内边距），实测可容纳最长的映射地址 234pt、本地服务行 263pt 和设置行 165pt。转发行因此改为纵向堆叠：上行是链路指示、服务名与状态，中行是占满宽度的映射地址，下行是操作；"复制地址"与"停止转发"使用带 tooltip 的图标按钮，避免三个文字按钮挤占地址列。所有 Form Sheet 宽度不得超过窗口宽度。

内容容器只保留 Data List、Inline Notice 和 Form Sheet 三种；减少 Panel 嵌套和 SaaS 卡片矩阵。在线、离线、警告和失败使用独立 token，并同时显示文字。正常在线状态只在设备详情或设置中展示；全局导航只在需要认证或连接失败时给设置图标增加警告 badge，不显示无法解释的常驻状态圆点。

### 10. 信息架构、列表与详情

设备和服务都采用顺序式单内容区，而不是双栏或“列表 + 详情”同时出现：

```text
devices.list -> devices.local-detail | devices.remote-detail(device)
forwards.list
logs
account
settings
```

点击设备图标总是回到设备列表；点击转发图标总是回到转发列表；日志、账户与设置都是独立单页。导航按归属分两组：设备与转发在上，日志、账户与设置作为应用级页面置于底部。身份与偏好分离——登录、账户、tailnet 身份归账户页，设置只保留外观、共享、调试与诊断，且同一事实不在多页重复。设备列表分为“这台 Mac”和“其他设备”两个 section，“添加设备”位于“其他设备”section 右侧，列表为空时也在空状态中提供，不占用全局工具栏。设备详情保留身份、连接、共享和服务信息，但删除装饰性 Route Line。

转发是长期开关而不是一次性打开：远端服务行提供“开始转发”，开启后该“设备 + 服务”长期持有稳定映射地址，Vela 重启后自动恢复，与“共享这台 Mac”语义对称。转发列表为每条转发显示链路指示、服务名、设备名、映射地址，并提供“在浏览器中打开”“复制地址”“停止”三个具名操作：

```text
+----------------------------------------------------------------+
|  转发                                            [ 查看设备 ]  |
+------+---------------------------------------------------------+
| dev  | =-= OpenCode              [浏览器中打开][复制][停止]   |
| fwd  |     http://opencode-home-mac.localhost:47850            |
| log  |                                                         |
| set  |                                                         |
+------+---------------------------------------------------------+
```

链路指示是界面的签名元素：一段短轨道，转发中为连通实线，连接中为断开的警告色，已停止为淡化虚线。Vela 不提供标签页、前进、后退或刷新——这些属于浏览器。

本机服务采用列表行：名称、loopback URL、可用状态、共享状态与主要共享动作；编辑和删除进入 `…` 上下文菜单。OpenCode、DSH 与自定义服务同级，均可删除。设置采用 macOS Preferences 风格 section 行，不堆叠圆角卡片，连接状态放在第一个 section。

所有桌面 Form Sheet 使用固定三段结构：Header 只放标题和简短说明；Body 独立伸缩或滚动；Footer 固定在弹窗底部，以顶部分隔线与 Body 区分，并将取消、次要动作和提交按钮右对齐。按钮不得跟随 Body 普通内容流漂移。

添加设备使用约 `640 x 520pt` 桌面 Form Sheet：Tailnet 候选用 NSH `List`，单击选择、双击或 Enter 验证并添加；已添加和当前设备显示但禁用；手动私人名称是独立字段。添加服务使用约 `560 x 420pt` Form Sheet，通过 AppKit popup/menu 选择 OpenCode、DSH 或自定义 HTTP 预设，再编辑名称与 loopback URL。设备改名和 DSH 认证同样复用三段式 Form Sheet。`nsh/ui/mobile` 的 Button、Card、Group、ListView、Sheet、Stack 不用于 PC 主界面；Modal 只作为 desktop form-sheet 宿主。

### 11. 外观、诊断与偏好存储

NSH 的 JS 环境没有 DOM，也不提供 `localStorage` 或任何键值存储模块（`globals.d.ts` 只有 `console`、`performance` 与定时器）。因此用户偏好必须由 Go Core 持久化到既有的 `config.json`，而不是在 UI 侧另造存储：外观、性能 HUD 与详细日志作为 `preferences` 字段随配置原子写入，UI 启动时从 `status.get` 读取并应用。

UI 应用外观使用 NSH 自带的 `setColorScheme`，调试 HUD 使用宿主桥接的 `AppView::set_fps_monitor`；窗口透明或毛玻璃不在支持范围内，NSH 没有对应窗口选项，不自行实现原生材质。

诊断数据必须来自真实运行状态而不是本机配置推导：活动连接以 `mappings.Manager` 当前映射为唯一来源，覆盖远端 manifest 发布的服务；日志覆盖认证、远端刷新、服务探测、共享发布、映射与代理失败路径，并统一经过 `diagnostics.Redact`。偏好或诊断更新不得触发整页状态重建。

### 12. 使用原生 macOS 菜单和标准快捷键

Rust 宿主或 NSH desktop menu 提供：

- Vela：About、Settings、Hide、Quit；
- File：Add Mac、Close Window；
- Edit：标准编辑角色；
- View：Devices、Opened Services、Settings、Reload、Full Screen；
- Window：标准窗口角色。

服务页面运行在用户的浏览器里，因此 Vela 不再需要让出键盘输入，也不会与 OpenCode/DSH 的快捷键冲突。

快捷键为 `Cmd+1` 设备列表、`Cmd+2` 转发、`Cmd+3` 日志、`Cmd+4` 账户、`Cmd+,` 设置、`Cmd+N` 在设备模块添加设备、`Cmd+R` 刷新当前模块、`Cmd+[` 或 Escape 从详情返回所属列表。不存在侧栏展开/折叠快捷键。

### 13. 数据与凭据按用途分离

建议目录：

```text
~/Library/Application Support/Vela/
  config.json             remote Macs and sharing choices
  network/                tsnet identity and state
  web-data/<device>/<service>/
~/Library/Logs/Vela/
  core.log
```

配置不保存 OpenCode 密码、DSH token 或 Tailscale auth key。目标服务 Cookie 由 WebKit 数据域管理。诊断复制默认包含版本、状态、连接类型和脱敏错误，不包含页面内容、Cookie、认证 URL、prompt、文件内容或 Authorization header。

### 14. `.app` 使用可重复组装和整体签名

构建流程：

1. 为目标架构构建 Go `vela-core`。
2. 构建 NSH TSX bundle 与自定义 Rust macOS runner。
3. 组装 `Vela.app`，把 Core 放入 `Contents/Helpers/vela-core`。
4. 先签名 helper，再签名外层 App；开发期允许 ad-hoc，自用分发可后续加入 Developer ID 与 notarization。
5. 构建后验证 bundle 结构、签名、helper 可执行性和关闭窗口保活行为。

标准 `nsh package` 不原生声明任意 helper，因此使用项目自有组装脚本，而不在打包后依赖手工复制。

### 15. UI 分层：原子组件、业务组件与数据层

> 2026-10 决策：UI 代码按职责分层。此前 `App.tsx` 一个文件同时承担 Core 通信、状态管理、导航、页面布局和行级渲染，达到 626 行、31 个 signal、18 处 `CoreBridge.request`、7 处 `JSON.parse`，其中 23 行超过 300 字符（最长 1609 字符）。混合职责是这些超长行、重复样式与多种页头写法的直接原因。

目录职责固定如下，依赖方向只能自下而上：

```text
ui/core/      数据层：Core 通信与状态，不含任何 JSX
  client.ts     统一 request + 解析 + 错误归一
  store.ts      状态与轮询，signal 集中在一处

ui/ui/        原子组件：无业务语义，只接受数据与回调
  tokens.ts     语义 token 的唯一来源
  page.tsx      Page / PageHeader，统一所有页面 shell
  alert.tsx     Alert（info / success / warning / danger）
  callout.tsx   Callout，行内说明
  card.tsx      Card / CardHeader / CardContent / CardFooter
  list.tsx      List / ListRow，唯一的数据行实现
  log-list.tsx  LogList / LogRow，时间 + 等级 + 消息
  field.tsx     Field / TextInput / RadioGroup
  switch.tsx    Switch，布尔偏好
  sheet.tsx     FormSheet，复用 PageHeader
  button.tsx badge.tsx link-track.tsx separator.tsx

ui/features/  业务组件：拼装原子组件、读数据层，不写颜色与间距字面量
  devices/ forwards/ logs/ account/ settings/

App.tsx       只做导航、pane 路由与 Modal 挂载
```

约束：原子组件不得 import `ui/core/` 或 `ui/features/`；业务组件不得出现十六进制色值、`dark:` 变体或 padding 字面量；`App.tsx` 不得直接调用 `CoreBridge`。

每个页面 MUST 使用同一个 `Page` + `PageHeader`：`title` + 可选 `description` + 可选 `actions` + 内容。此前五个 pane 各自拼 `Scroll` 与容器、存在 `gap-4` 与 `gap-5` 两种节奏、三种页头写法（`DetailHeader`、`text-section` 标题行、`text-caption` 标题行），且设备页没有 `-view` 标识因而从未被结构测试覆盖。

卡片与列表按 shadcn/ui 的组合式结构提供，而不是每处手写行布局：

```text
Card            容器：圆角、发丝边框、surface 底
  CardHeader      标题 + 可选说明 + 可选动作
  CardContent     自由内容
  CardFooter      说明或次级动作
List            行容器：统一分隔线与空状态
  ListRow         统一行：leading? / 标题 + 可选说明 + 可选徽标 / trailing actions?
```

`ListRow` 是全部页面（设备列表与详情、转发、账户、设置）唯一的行实现，按内容定高（`py-1.5`、最小 32pt）、`px-4` 水平内边距，并统一处理“信息在左、操作在右”的布局与文字截断；双行数据行通过 `description` 而不是另一套行高表达。

此前共存 7 种行实现与 5 种行高（`24` / `28` / `44` / `56` / `64pt`），其中 `min-h-[56px] … px-4 py-3` 在 `App.tsx` 与 `ui/primitives.tsx` 各有一份完整副本；设备列表自绘 `min-h-[64px]` 与手动边框，与详情页数据行不同源。每处手写“信息 + 操作”布局是这些漂移的根因。

### 16. 运行日志按日志的方式呈现，而不是复用设置行

日志的阅读方式是按时间扫视、按严重度跳读，因此它需要专门的 `LogList`，而不是复用“标题 + 说明”的数据行：

```text
14:03:51  ERROR  network   无法连接到 home-mac
14:03:48  WARN   service   dsh is unavailable
14:03:40  INFO   sharing   已发布 2 个服务
```

- 时间为等宽窄列并转为本机时区，可纵向对齐扫读；此前原样输出 RFC3339（`2026-10-22T14:03:51Z`），既不可读也无法对齐。
- 等级使用语义色徽标，而不是纯文字；此前 `error` / `warn` / `info` 没有任何视觉区分。
- 消息占满剩余宽度并作为主体；此前 `title` 是 `area · level`，真正的消息被拼进 `detail` 的后半段。
- 提供按等级筛选，默认显示全部；此前 200 条混排且无法收窄。

### 17a. 转发行：开关 + 端点块

转发是长期布尔状态，因此由开关控制，不再是“开始转发 / 停止转发”两个按钮。开启后，地址以独立的端点块出现在标题下方：

```text
ComfyUI                              ↗  ⧉  (●  )
┌──────────────────────────────────────────────┐
│ =-=  comfyui-vela-macmini.localhost:49507    │
└──────────────────────────────────────────────┘
OpenCode  Web 服务                         (  ○)
```

- 未开启时只占一行；开启后多出端点块。
- 端点块是浅色内凹底（`surfaces.well`）配等宽字，地址显示为 `host:port`，不带 `http://`。点击地址即在浏览器中打开（仅 Web）。
- 链路指示放在端点块内，是这一行唯一的状态标记；不再另有“转发中”徽标，也不再挂一排按钮。
- 操作只有两个图标，放在标题行开关旁：在浏览器中打开（仅 Web）、复制。TCP 的复制按钮复制完整连接命令，tooltip 写明具体命令。
- 连接中在端点块内显示“正在建立链路…”；失败时开关保持开启（用户意图不变），端点块变为危险色并写明原因，附“重试”。关闭开关会撤销仍在进行的连接尝试，迟到的结果不会让这一行复活。
- 设备详情与“转发”页使用同一个 `ForwardRow`，两处外观与行为一致；“转发”页在端点块下注明设备名。

实测依据：480pt 窗口下行宽 360pt。若把两个图标放进端点块，留给地址的只有 242pt，而真实地址最长约 265pt（`opencode-2-vela-macmini.localhost:65497`）；端点块只保留链路指示时可用 314pt，全部能完整显示。此前把三个按钮放在行尾时，地址只剩 139pt。

### 17. 布尔偏好使用开关，动作使用按钮

布尔状态由 `NSSwitch` 表达，行内不再给出状态文字或反向动作按钮；`description` 改为说明这个开关做什么。此前四处 toggle 都是“状态文字 + 反向按钮”的组合：

```text
现在： 共享这台 Mac    已开启        [ 停止 ]
改为： 共享这台 Mac    仅已授权设备可访问    ( ●)
```

“已开启”与“停止”并排要求用户先读状态再反推按钮含义。开关把状态与操作合并为一个控件，并符合 macOS 偏好惯例。

区分标准：持续性布尔用开关（共享这台 Mac、每个本地服务的共享、每个远端服务的转发、性能 HUD、详细日志）；一次性动作仍用按钮（重新连接、注销、添加、删除、复制）；只读事实仍是文字（状态、地址、兼容性、上次连接）。

`NSSwitch` 自 macOS 10.15 起可用，远低于 Vela 的 macOS 14 底线。

### 18. 列表行展示信息，破坏性操作留给详情

列表行整行可点进入详情，MUST NOT 在行内放置破坏性操作；行宽优先给真正要读的事实。设备行承载状态、可用服务数与完整地址：

```text
现在： ● MacBook Pro  在线          [ 删除 ]  >
       2 个可用服务
       100.101.102.103 …（被截断）
改为： MacBook Pro          在线          >
       2 个可用服务 · 100.101.102.103
       fd7a:115c:a1e0:ab12:4843:cd96:6265:1234
```

实测依据：480pt 窗口下行内容宽 360pt，“删除”按钮占 42pt（12%），连同指示箭头与间距后只剩 294pt，而完整 IPv4 + IPv6 需要 388pt。低频且不可逆的操作挤掉了高频信息。

删除设备已存在于设备详情页，列表行通过上下文菜单提供同一入口，不占用行宽也不易误触。

### 19. 一项状态只呈现一次

状态 MUST 由一个带色的文字标签表达，MUST NOT 再并排一个同义的色点。文字能区分 `needs-auth`（“需要连接”）这类色点无法表达的状态，并且本身已经携带语义色，因此色点只是重复。

此前同一事实最多出现三次：设备列表行是“绿点 + 绿字在线”，而设备详情与账户页的“状态”行同时给出 `detail` 文字和包含点与文字的 `StatusMark`。

### 20. 提示信息使用 Alert 与 Callout，而不是平铺长文本

需要用户注意的状态使用 `Alert`：带图标、可选标题、描述与可选动作，底色为同色系浅色块。仅作说明的短句使用 `Callout`。两者都从 token 取色，页面不得再出现裸的长句 `Text`。

Alert 的四种语气均经过实测，文字对 Alert 底色不低于 4.5:1，底色对画布保持可感知差异：

| 语气 | Light 底 / 字 | Dark 底 / 字 |
|---|---|---|
| Info | `#F0EBE4` / `#7A4A28` | `#2A2621` / `#E8A87C` |
| Success | `#E9EFE6` / `#3C5430` | `#242B22` / `#A5CC90` |
| Warning | `#F5EDDC` / `#6E4F19` | `#2E2819` / `#E8BE78` |
| Danger | `#F7E7E4` / `#8C2E24` | `#2E2220` / `#F0998D` |

### 21. 禁用态是显式 token，而不是整体降透明度

`primary` 按钮禁用时 MUST 使用独立的禁用底色与墨色，而不是让 AppKit 对彩色 bezel 做淡化。原因是实测：`attributedTitle` 指定的不透明白色会被 AppKit 淡化，但 `bezelColor` 的赭色不会，导致淡白字压在饱和赭底上，对比度降到 `1.46:1`（启用态为 `7.45:1`）。

禁用态取 `subtle` 底色配 `#5F5B55`（Light）/ `#A8A29A`（Dark）墨色，实测对自身底色分别为 `5.36:1` 与 `5.50:1`，既清晰可读又明确表达不可用。

### 22. 服务协议：HTTP 与 TCP

> 2026-10 决策：服务新增 `protocol` 字段（`http` | `tcp`），使 Vela 能转发 SSH、Redis、MySQL、PostgreSQL 等非 Web 服务。转发链路本身不绑定 HTTP：`tunnel` 是纯 TCP 双向复制，`mappings`、`inbound`、`publication` 都只处理字节流。HTTP 只绑定在三处边缘：服务校验 `ValidateURL`、健康探测 `Prober` 与访问端的“交给浏览器”。本节只改这三处并新增协议字段。

不设单独的 `ssh` 协议：SSH、数据库与 Redis 在转发层完全相同，它们都是 `tcp` 的预设，正如 OpenCode、DSH 是 `http` 的预设。旧配置没有该字段，迁移时视为 `http`。

**预设按协议分组**，添加服务时以两组常显选项呈现：

| 分组 | 预设 | 默认 loopback 地址 | 访问方式 |
|---|---|---|---|
| Web 服务 | OpenCode | `127.0.0.1:49374` | 浏览器 |
| | DSH | `127.0.0.1:3080` | 浏览器 |
| | ComfyUI | `127.0.0.1:8188` | 浏览器 |
| | 自定义 HTTP | 自填 | 浏览器 |
| TCP 服务 | SSH | `127.0.0.1:22` | `ssh -p <port> <user>@ssh-<device>.localhost` |
| | Redis | `127.0.0.1:6379` | `redis-cli -h <host> -p <port>` |
| | MySQL | `127.0.0.1:3306` | `mysql -h 127.0.0.1 -P <port>` |
| | PostgreSQL | `127.0.0.1:5432` | `psql -h <host> -p <port>` |
| | 自定义 TCP | 自填 | 复制地址 |

MySQL 的命令使用 `127.0.0.1` 而非 `.localhost` 主机名：`mysql` 客户端遇到 `localhost` 类名称时会改走 Unix socket。TCP 服务不涉及 Cookie，不需要按主机名隔离。

**ComfyUI 是普通 HTTP 预设，不需要 adapter。** 已在 Mac mini 实测：`/system_stats` 返回 200 JSON，可作健康探测；`/ws` WebSocket 升级返回 101；ComfyUI 的 `origin_only_middleware` 只要求 Host 与 Origin 一致，不要求为 `127.0.0.1`，转发后 Host 与 Origin 均为 `comfyui-<device>.localhost` 时请求正常进入业务逻辑，两者不一致才返回 403。因此无需像 DSH 那样改写 authority。ComfyUI 没有自身认证，若以 `--listen 0.0.0.0` 启动则已对局域网开放；Vela 只连接其 loopback 地址，既不扩大也无法收窄这一暴露面，文档需提示改用 `--listen 127.0.0.1`。

**TCP 健康探测不得建立连接。** 对 TCP 服务发出握手会带来实际伤害：SSH 会把非法握手记入日志并可能触发封禁；MySQL 默认在 100 次失败握手后封禁客户端地址（`max_connect_errors`），按在线时每 10 秒探测一次计算，约 17 分钟就会封掉 loopback，使数据库拒绝本机连接。因此 TCP 探测改为不触碰服务：

- 非特权端口：以不带 `SO_REUSEADDR` 的方式尝试绑定同一 loopback 端口，`EADDRINUSE` 即表示有服务在监听，随后立即释放。已实测服务绑定 `127.0.0.1`、`0.0.0.0`、`[::]` 三种情况均能正确识别，且不产生任何连接。
- 特权端口（如 `22`）：普通用户绑定会返回 `EACCES`，无法据此判断（已实测），改为读取系统监听表，同样不建立连接。

**访问端按协议给出访问方式。** `http` 转发交给默认浏览器；`tcp` 转发没有 URL，转发行改为显示可复制的连接命令与 `host:port`，不提供“在浏览器中打开”。稳定端口同样适用，使 `~/.ssh/config` 中的固定 `Host` 条目长期有效（已实测 `ssh-<device>.localhost` 解析到 `127.0.0.1` 与 `::1`，`ssh -G` 正确识别主机与端口）。

**安全边界。** TCP 目标仍只允许 loopback，Vela 不会成为能拨任意地址的 TCP 跳板。Vela 不参与 SSH 或数据库认证，密钥、密码由目标服务自行校验。SSH 预设首次共享时的确认文案必须单独写明“可获得这台 Mac 的命令行”。远端 Mac 必须自行开启“远程登录”，Vela 不会替用户启用；SSH 不可用时提示应指向这一设置，而非笼统的“不可用”。

**清单版本升至 2。** 旧版 Vela 的清单过滤只校验端口与 `available`，会把 TCP 服务当作 Web 服务交给浏览器。升级清单版本使旧版显示“需要更新 Vela”，而不是打开错误的页面；代价是两台 Mac 需同时更新。

### 23. 运行中被删除的设备靠“重新检查”发现

在 Tailscale 后台删除一台正在运行的设备时，控制平面不会通知它：内嵌节点继续使用缓存的网络地图，并一直报告 `Running`。只有它重新登录时，控制平面才会拒绝原身份，返回新的认证地址。实测：在已删除的身份上重启控制客户端后约 3 秒，状态仍为 `Running`，但出现了待处理的认证地址；健康节点做同样操作后，约 2 秒重新上线。

因此：

- 状态映射：`Running` 但带有待处理认证地址时，视为“需要连接”。
- “重新检查”（`auth.reconnect`）不再复用交互登录：它通过 LocalAPI `Start` 重建控制客户端，让节点重新登录，最多等待 12 秒，直到节点重新上线（已连接）或拿到新的认证地址（需要连接）。超时未出结论时沿用最近的状态，绝不因网络慢而把用户登出。
- 检查期间按钮显示“正在检查…”并禁用。

曾尝试用 `QueryFeature` 向控制平面查询本节点，在已删除节点上只返回 `zero serverNoiseKey` 或 `no netmap`，无法区分“已删除”与“暂时不可达”，已放弃。

## Sequence Diagrams

### 打开远端服务

```text
User       NSH UI       Rust Host       Local Core       Remote Core      OpenCode
 |            |             |                |                 |              |
 | Open       |             |                |                 |              |
 |----------->| map.open    |                |                 |              |
 |            |------------>| map.open       |                 |              |
 |            |             |--------------->|                 |              |
 |            |             |                | tsnet dial      |              |
 |            |             |                |---------------->| whois/allow  |
 |            |             |                |                 | connect      |
 |            |             |                |                 |------------->|
 |            |             | local URL      |                 |              |
 |            |<------------|<---------------|                 |              |
 |            | browser load http://<svc>-<dev>.localhost:<p>  |              |
 |            |==============================================================>|
```

### 首次私人网络认证

```text
User       NSH UI       Rust Host       Go Core       Browser       Control Plane
 |            |             |              |              |               |
 | Connect    |             |              |              |               |
 |----------->|------------>| auth.start   |              |               |
 |            |             |------------->|              |               |
 |            |             | auth URL     |              |               |
 |            |             |<-------------|              |               |
 |            |             | open URL     |              |               |
 |            |             |----------------------------->|               |
 | authenticate                                          |--------------->|
 |<------------------------------------------------------>|               |
 |            |             |              | connected event             |
 |            |<------------|<-------------|<-----------------------------|
```

## Risks / Trade-offs

- [NSH 当前版本较新，macOS runtime 与打包接口可能变化] -> 锁定精确版本，把 NSH 限制在 UI/宿主边界，并用启动、菜单和窗口保活 smoke test 保护升级。
- [Go helper 增加第二进程和签名复杂度] -> 使用单一受控 pipe、父进程 EOF 自退出、可重复 App 组装和嵌套签名验证；不开放本地管理 HTTP 端口。
- [OpenCode/DSH 升级可能改变认证、Origin 或实时协议] -> 建立版本化端到端契约测试，服务特定兼容仅放在 adapter，失败时保留原生认证并给出明确诊断。
- [随机 loopback 端口可能改变页面 origin] -> 每个工作区运行期保持端口稳定、隔离 Web 数据域，并验证 Cookie、WebSocket 与 secure-context 行为；必要时引入受控稳定端口分配表。
- [tsnet 与 userspace netstack 增加二进制体积和内存] -> 首版接受体积换取系统网络隔离，测量 idle/active 占用并避免多 node 实例。
- [窗口隐藏后 App Nap 可能降低网络可靠性] -> 持有合理的 process activity，保持 Core 与窗口解耦，并在诊断中暴露最后连接和重连状态。
- [Mac 睡眠时服务不可达] -> 明确显示设备离线并自动恢复，不尝试伪造持续可用性，也不修改用户电源设置。
- [同一用户 tailnet 内设备默认授权仍可能过宽] -> Host 每次执行 WhoIs，保留设备 allowlist 模型，并在共享首次开启时解释远程代码执行风险。
- [共享的系统浏览器按 host 而非端口隔离 Cookie] -> 为每个“设备 + 服务”派生独立的 `<service>-<device>.localhost` 主机名，使同名服务在不同设备上互不覆盖，而不是降低会话隔离要求。

## Migration Plan

1. 先以开发签名构建 Vela，并在两台测试 Mac 上创建独立私人网络身份。
2. 默认关闭“共享这台 Mac”；用户完成认证后显式启用 OpenCode 或 DSH。
3. 先验证 OpenCode 全链路，再启用 DSH adapter 与其 authority 指引。
4. 验证两台 Mac 同时共享和访问、窗口隐藏常驻、Core 崩溃恢复及正式退出清理。
5. 发布前固定 NSH、Go 和 Tailscale 依赖版本，执行 universal/目标架构构建、签名和真实网络 soak test。

回滚时退出并删除 Vela 即可；OpenCode、DSH 与系统网络不受影响。若仅需临时停用，关闭“共享这台 Mac”或注销 Vela 私人身份，无需卸载本地开发服务。

## Open Questions

- 首版开发签名只覆盖 Apple Silicon，还是在首次可用版本中同时产出 universal binary；该选择不改变协议和产品行为，可在构建阶段根据目标设备确定。
- Vela Route Line 最终采用 NSH Canvas 还是基础 View 组合；两者必须满足相同的静态、动效和可访问性行为。
