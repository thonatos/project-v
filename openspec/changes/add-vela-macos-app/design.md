# Design

## Context

参见 `proposal.md` 的动机与范围。当前仓库没有 Vela 实现；这是一个独立的新 macOS 产品面。家中 Mac mini 已常驻运行 OpenCode V2 Web 与 DSH Web，Vela 不负责这些进程的生命周期。

关键约束如下：

- OpenCode V2 默认监听 `127.0.0.1:49374`，具备配对、Cookie、事件流和 PTY WebSocket。
- DSH 默认监听 `127.0.0.1:3080`，使用 token/Cookie，并校验 Host、Origin 与可信 authority。
- Vela 不得创建系统 VPN、修改代理、DNS 或路由；私人网络只服务 Vela 自身流量。
- NSH 的 TSX 层适合界面，但不能直接承载 TCP listener、进程监督或 `tsnet`；NSH 的 macOS WebView 可以访问 Vela 在 loopback 上提供的本地映射。
- NSH 标准 macOS runner 支持原生界面和 WebView，但 Vela 需要自定义 Rust 宿主来持有应用级生命周期、设置 `keep_alive_on_close`、桥接 Core 并组装辅助二进制。
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
| | device UI / settings / workspace / WebView   | |
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

- NSH TSX：可见界面、界面导航、视觉状态、WebView 工具栏和设置表单。
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

NSH WebView 不直接拨号 tailnet。用户打开服务时，Core 在 `127.0.0.1:0` 创建临时 listener，并把每条连接通过 `tsnet.Dial` 送到远端服务端口：

```text
NSH WebView
    |
    | http://127.0.0.1:<ephemeral>
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

这种方式让 WebView 使用普通 loopback URL，保留 secure-context 语义，不修改系统代理，也可以透明承载 HTTP、SSE、WebSocket 和原始升级连接。代理层使用流式复制，不读取业务 payload，不对响应整体缓冲，并支持 TCP 半关闭和长空闲连接。

每个“远端设备 + 服务”拥有独立的持久化 Web 数据域。若 NSH 内置 WebView 无法指定独立 `WKWebsiteDataStore`，Rust 宿主将注册一个定制 WebView native component；不得以共享 Cookie store 交付存在登录冲突的版本。

本地映射仅监听 IPv4/IPv6 loopback。映射 URL 和随机端口属于本机内部实现，不进入 Host 清单，也不作为跨设备协议。

### 6. 保持目标服务认证并最小化 authority 改写

Vela 不代替 OpenCode V2 或 DSH 登录：

- OpenCode 配对路径通过本地映射打开，成功后 Cookie 留在对应 Web 数据域。
- DSH token URL 同样通过本地映射打开。
- Host 代理默认透明转发 Host、Origin、Set-Cookie 和 Upgrade 语义。
- 因 WebView 实际 authority 是 loopback 映射，优先让后端看到一致的 loopback Host 与 Origin；若 DSH 版本仍拒绝，则界面展示需要加入的 Vela authority，不通过无条件删除 Origin 或伪造安全头绕过。

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

NSH bundle reload、页面切换和 WebView 销毁不得停止 Core。Rust 宿主持有 macOS process activity，降低窗口隐藏后 App Nap 对常驻网络服务的影响，但不阻止整机睡眠。

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

### 9. UI 采用设备中心和 Technical Cartography 视觉语言

默认窗口建议 `1080 x 720`，最小 `820 x 560`，使用 228pt 设备侧栏和约 52pt 自定义标题栏。布局如下：

```text
+----------------------------------------------------------------+
| traffic lights  Vela                         Connected   gear    |
+----------------------+-----------------------------------------+
| DEVICES              | Home Mac mini                           |
| * This Mac           | Online                                  |
|                      |                                         |
| MY MACS              | You o----------------o Home Mac          |
| > Home Mac mini      |                 private route           |
|   Office MacBook     |                       +-- OpenCode       |
| + Add Mac            |                       +-- DSH            |
|                      |                                         |
|                      | OpenCode                     [ Open ]    |
|                      | DSH                          [ Open ]    |
+----------------------+-----------------------------------------+
| Private network: Connected                 Checked just now     |
+----------------------------------------------------------------+
```

视觉 token：

| 角色 | Light | Dark |
|---|---|---|
| Fog / 侧栏 | `#F2F5F4` | `#101718` |
| Panel / 主面 | `#FBFCFB` | `#172022` |
| Ink / 主文字 | `#182224` | `#EBF2F0` |
| Slate / 次文字 | `#687477` | `#96A4A1` |
| Route / 连接 | `#16877F` | `#45B8AD` |
| Caution / 警示 | `#C27A27` | `#DCA357` |

字体使用系统 SF Pro Text、SF Pro Display 和 SF Mono。Route 色只用于真实连接、选择和焦点，不做大面积渐变。服务使用分隔行，不堆叠 SaaS 风格卡片。

标志性元素 Vela Route Line 由 NSH Canvas 或基础 View 绘制，表达所选设备到服务的真实状态。在线为完整线，连接中只播放一次方向性绘制，离线为断线，单服务不可用时对应分支变灰；所有状态同时有文字，减少动态效果时立即切换静态图形。

### 10. 信息架构与服务焦点模式

设备侧栏分为“这台 Mac”和“我的 Mac”。选择本机显示共享总开关及 OpenCode/DSH 状态；选择远端显示连接路径、服务和打开动作。

打开服务后进入焦点工作区，隐藏侧栏：

```text
+----------------------------------------------------------------+
| < Devices  Home Mac / OpenCode     Connected   back fwd reload |
+----------------------------------------------------------------+
|                                                                |
|                         WebView                                |
|                                                                |
+----------------------------------------------------------------+
```

工具栏保持克制，只提供返回设备页、前进、后退、刷新、设备/服务标题、连接状态和更多菜单。首版同一时刻仅展示一个工作区，不实现标签页。工作区断线时显示具名覆盖层，不留空白页面。

设置分为 General、Private Network、Sharing 和 Diagnostics。主界面称“私人连接”，设置详情明确标注由 Tailscale 提供，保证透明度。

### 11. 使用原生 macOS 菜单和标准快捷键

Rust 宿主或 NSH desktop menu 提供：

- Vela：About、Settings、Hide、Quit；
- File：Add Mac、Close Window；
- Edit：标准编辑角色；
- View：Devices、OpenCode、DSH、Toggle Sidebar、Reload、Full Screen；
- Window：标准窗口角色。

WebView 获得焦点时，除 `Cmd+Q`、`Cmd+W`、`Cmd+,` 和明确的 Vela 导航快捷键外，其余输入交给页面，避免破坏 OpenCode/DSH 快捷键。

### 12. 数据与凭据按用途分离

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

### 13. `.app` 使用可重复组装和整体签名

构建流程：

1. 为目标架构构建 Go `vela-core`。
2. 构建 NSH TSX bundle 与自定义 Rust macOS runner。
3. 组装 `Vela.app`，把 Core 放入 `Contents/Helpers/vela-core`。
4. 先签名 helper，再签名外层 App；开发期允许 ad-hoc，自用分发可后续加入 Developer ID 与 notarization。
5. 构建后验证 bundle 结构、签名、helper 可执行性和关闭窗口保活行为。

标准 `nsh package` 不原生声明任意 helper，因此使用项目自有组装脚本，而不在打包后依赖手工复制。

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
 |            | WebView load http://127.0.0.1:<port>           |              |
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

- [NSH 当前版本较新，macOS runtime 与打包接口可能变化] -> 锁定精确版本，把 NSH 限制在 UI/宿主边界，并用启动、菜单、WebView 和窗口保活 smoke test 保护升级。
- [Go helper 增加第二进程和签名复杂度] -> 使用单一受控 pipe、父进程 EOF 自退出、可重复 App 组装和嵌套签名验证；不开放本地管理 HTTP 端口。
- [OpenCode/DSH 升级可能改变认证、Origin 或实时协议] -> 建立版本化端到端契约测试，服务特定兼容仅放在 adapter，失败时保留原生认证并给出明确诊断。
- [随机 loopback 端口可能改变页面 origin] -> 每个工作区运行期保持端口稳定、隔离 Web 数据域，并验证 Cookie、WebSocket 与 secure-context 行为；必要时引入受控稳定端口分配表。
- [tsnet 与 userspace netstack 增加二进制体积和内存] -> 首版接受体积换取系统网络隔离，测量 idle/active 占用并避免多 node 实例。
- [窗口隐藏后 App Nap 可能降低网络可靠性] -> 持有合理的 process activity，保持 Core 与窗口解耦，并在诊断中暴露最后连接和重连状态。
- [Mac 睡眠时服务不可达] -> 明确显示设备离线并自动恢复，不尝试伪造持续可用性，也不修改用户电源设置。
- [同一用户 tailnet 内设备默认授权仍可能过宽] -> Host 每次执行 WhoIs，保留设备 allowlist 模型，并在共享首次开启时解释远程代码执行风险。
- [NSH 内置 WebView 可能无法隔离 WebsiteDataStore] -> 在实现 Web UI 前完成能力 spike；不满足时使用 Rust 宿主注册的原生 WKWebView component，而不是降低会话隔离要求。

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
