# Tasks

## 1. 工程骨架与风险验证

- [x] 1.1 建立 Vela 的 NSH UI、Rust macOS 宿主、Go Core、共享协议与测试目录，并通过工作区构建命令验证各空模块可独立编译。
- [x] 1.2 锁定 NSH、Go、Tailscale/tsnet 及 Rust 依赖的精确版本，记录 macOS 14+ 与构建工具要求，并验证干净环境可以解析全部依赖。
- [x] 1.3 制作 NSH macOS WebView 能力 spike，验证 Cookie、SSE、WebSocket、上传下载和 Web 数据域隔离；若内置 WebView 不能隔离数据域，则交付 Rust 原生 WKWebView component 原型并以两个同名 Cookie 测试证明隔离成立。
- [x] 1.4 定义 `Vela.app` 目录、Bundle ID、Application Support/Logs 路径与进程权限边界，并通过路径单元测试确认所有可写数据均位于用户目录而非 App Bundle。

## 2. Core 控制协议与持久化

- [x] 2.1 定义版本化 JSON Lines 请求、响应、事件、状态和结构化错误 schema，并通过 Go 与 Rust 的双向 fixture 测试验证兼容解析、未知版本和未知消息拒绝行为。
- [x] 2.2 实现 Go Core 的 stdin/stdout 控制循环和独立 stderr 日志，覆盖快照、事件订阅与 shutdown，并通过进程测试验证日志不会污染协议流。
- [x] 2.3 实现 Rust Core supervisor 和 typed NSH native module，覆盖请求关联、事件分发、Core EOF、有限退避重启与退出期间禁止重启，并通过伪 Core 集成测试验证全部状态转换。
- [x] 2.4 实现远程 Mac、共享选择和最近连接状态的原子配置存储，并通过中断写入、损坏文件降级和并发更新测试验证不会产生部分配置。
- [x] 2.5 编写控制协议与数据目录开发文档，并以文档中的示例消息运行协议 fixture 校验。

## 3. 私人网络与身份

- [x] 3.1 在 Go Core 中创建单一持久化 tsnet node，明确禁用 exit node、subnet route 和 TUN 路径，并通过启动测试与系统网络配置快照验证 Vela 不修改代理、DNS 或路由。
- [x] 3.2 实现交互认证 URL、连接状态、身份恢复、重新认证和注销命令，并通过测试 tailnet 验证首次登录、重启免登录和设备撤销后的 `needs-auth` 状态。
- [x] 3.3 实现网络中断与接口变化后的有界自动重连和手动重试，并通过网络故障注入测试验证 `connecting/connected/offline/needs-auth` 事件顺序。
- [x] 3.4 实现远端连接 WhoIs 与本机授权策略接口，默认限制为当前用户并保留设备 allowlist 扩展点；通过授权和未授权 node 测试验证拒绝发生在连接本地目标之前。
- [x] 3.5 增加私人网络日志脱敏规则和状态诊断快照，并通过 fixture 验证认证 URL、密钥、Cookie、Authorization header 和业务内容不会进入复制诊断结果。

## 4. 本机服务共享

- [x] 4.1 实现 OpenCode V2 `127.0.0.1:49374` 与 DSH `127.0.0.1:3080` 的独立健康探测及周期刷新，并通过可用、拒绝连接、超时和错误响应测试验证状态分类。
- [x] 4.2 实现“共享这台 Mac”总开关和 OpenCode/DSH 分项选择，使 listener 仅在网络已连接、总开关开启、服务已选且可用时发布；通过状态矩阵测试验证关闭共享不影响远端访问能力或本地服务进程。
- [x] 4.3 实现固定 Vela 控制端口及 `/vela/v1/manifest`、`/vela/v1/health`，并通过契约测试验证清单不泄露本机 target、不发布禁用服务且正确拒绝不兼容版本。
- [x] 4.4 实现 OpenCode 与 DSH 的独立 tailnet TCP listener 和流式双向代理，覆盖半关闭、背压、长空闲连接和 listener 关闭；通过 HTTP、SSE、WebSocket、上传与下载集成测试验证不缓冲完整响应。
- [x] 4.5 实现服务 adapter 的 Host/Origin/Cookie/Upgrade 策略，默认透明且仅对已验证兼容问题做定向处理；通过 OpenCode 配对和 DSH trusted-host fixture 验证不会绕过目标服务认证或接受未知代理目标。
- [x] 4.6 编写本机共享安全边界与 DSH authority 配置说明，并按文档从默认 loopback 服务完成一次手动配置验证。

## 5. 远程设备与本地映射

- [x] 5.1 实现通过私人名称添加、校验、保存、刷新和移除远程 Mac，并通过在线、离线、名称无效、未授权和协议不兼容测试验证记录创建规则与错误反馈。
- [x] 5.2 实现远端 manifest 客户端和服务状态缓存，并通过模拟远端状态变化测试验证只呈现兼容且当前共享的 OpenCode/DSH。
- [x] 5.3 实现按“远端设备 + 服务”创建的 IPv4/IPv6 loopback 临时 listener、运行期稳定映射和引用计数关闭，并通过端口占用与非 loopback 绑定检查验证隔离。
- [x] 5.4 实现本地映射到远端 Vela listener 的 tsnet 拨号和透明 TCP 复制，并通过断线、重连、并发连接、半关闭及长连接测试验证资源正确释放。
- [x] 5.5 实现映射打开、关闭与状态事件的 Core 协议命令，并通过 Rust-Go 集成测试验证 UI 获得可加载的本地 URL且错误不会退化为空白状态。

## 6. Rust macOS 宿主与应用生命周期

- [x] 6.1 创建自定义 NSH macOS runner，设置初始/最小窗口尺寸、自定义标题栏和 `keep_alive_on_close`，并通过 UI smoke test 验证红色关闭和 `Cmd+W` 仅隐藏窗口。
- [x] 6.2 实现 Dock 激活恢复现有窗口、NSH bundle 重载不重启 Core 和窗口状态同步，并通过 PID/连接计数断言验证隐藏与恢复期间 Core 身份不变。
- [x] 6.3 配置原生 Vela、File、Edit、View 和 Window 菜单及标准快捷键，并通过菜单 UI 测试验证 `Cmd+,`、`Cmd+W`、侧栏切换、刷新、全屏和 WebView 按键优先级。
- [x] 6.4 实现应用级 process activity，使窗口隐藏时 Core 可继续服务但不阻止整机睡眠，并通过窗口隐藏后的远端健康请求验证共享持续可用。
- [x] 6.5 实现 `Cmd+Q`、应用菜单退出和 Dock 退出的有界优雅清理，先停接入和映射再关 tsnet/Core，超时则终止 helper；通过活动连接退出测试验证 App 在期限内结束且 helper 不残留。

## 7. NSH 设备中心界面

- [x] 7.1 实现 Fog/Panel/Ink/Slate/Route/Caution 颜色、SF 系统字体、8pt 间距和明暗模式 token，并通过 token、对比度和主题切换测试验证无未定义视觉值和文本对比问题。
- [x] 7.2 实现自定义标题栏、设备侧栏、底部私人连接状态和响应式主面板，并通过 NSH 布局与窗口尺寸测试验证 `1080x720` 和 `820x560` 下无裁切或重叠。
- [x] 7.3 实现“这台 Mac”和“我的 Mac”的统一设备导航、添加/移除 Mac 流程及在线/离线状态，使用用户文案而非内部网络术语；通过键盘导航测试验证焦点、选择和错误恢复。
- [x] 7.4 实现本机共享页面，包括总开关、固定服务状态、分项开关、安全确认和再次检查，并通过 Core mock 状态矩阵测试验证所有开关和不可用状态。
- [x] 7.5 实现远程设备概览、服务行、最近连接、离线和协议不兼容界面，并通过 mock 状态 fixture 验证每种状态都包含文字、非颜色提示和可执行操作。
- [x] 7.6 实现 Vela Route Line 的在线、连接中、离线与服务分支状态，支持减少动态效果，并通过状态模型和 reduce-motion 测试验证图形语义与文字一致。
- [x] 7.7 实现首次认证、本机服务发现和添加远端 Mac 的非模式化 onboarding，并通过全新数据目录 UI 测试验证流程不会要求选择 Host/Client 模式。
- [x] 7.8 实现 General、Private Network、Sharing 和 Diagnostics 设置页以及脱敏诊断复制，并通过 `Cmd+,` 和内容 fixture 测试验证设置可达、保存生效且敏感字段不出现。

## 8. 服务工作区

- [x] 8.1 实现服务焦点模式，打开服务时隐藏侧栏并显示返回设备、前进、后退、刷新、设备/服务标题和连接状态；通过导航 UI 测试验证返回后恢复此前设备上下文。
- [x] 8.2 为每个“设备 + 服务”配置独立持久化 Web 数据域，并通过 OpenCode/DSH 同名 Cookie 与应用重启测试验证登录状态隔离和持久化。
- [x] 8.3 接入 Core 本地映射 URL，处理加载、连接中、离线、认证和映射失败覆盖层，并通过故障注入 UI 测试验证不会显示无说明的空白 WebView。
- [x] 8.4 验证 OpenCode V2 首页、一次性配对、30 天会话 Cookie、消息事件、工具权限、SSE 和 PTY WebSocket；将自动化契约测试与已验证版本记录随 adapter 一并提交。
- [x] 8.5 验证 DSH token/Cookie、trusted-host、RPC、WebSocket、插件资源、上传和下载；将 authority 拒绝诊断与自动化契约测试随 adapter 一并提交。

## 9. App 组装与集成验证

- [x] 9.1 实现可重复构建脚本，依次构建 Go helper、Rust/NSH runner 与 TSX bundle并组装 `Vela.app/Contents/Helpers/vela-core`，通过全新输出目录构建验证无手工步骤。
- [x] 9.2 实现开发期嵌套签名流程并验证 helper、外层 App、Bundle ID、Info.plist、图标和最低系统版本；通过 `codesign --verify --deep --strict` 及实际启动 smoke test 验证产物。
- [x] 9.3 在两台真实 Mac 上验证一台同时共享和访问另一台，覆盖 OpenCode/DSH 并发、直接/DERP 连接、断网恢复、窗口隐藏和 Core 崩溃恢复，并保存不含敏感数据的验收记录。
- [x] 9.4 运行协议、Go、Rust、NSH UI、契约和端到端测试套件以及 lint/typecheck/build，修复全部失败并记录一条可复现的发布前验证命令。
- [x] 9.5 完成 Vela 用户文档，覆盖首次连接、共享这台 Mac、添加远端 Mac、OpenCode 配对、DSH authority、退出语义、故障排查和卸载回滚，并逐条执行文档步骤验证结果。

## Workflow follow-up

- 实现与评审完成后归档该变更，并将四项 Vela 能力同步为主规格。
- iOS 客户端作为后续独立变更提出，复用本变更定义的 Vela Host 合约，而不修改 macOS 客户端的长期产品定位。

## 10. 设备与可配置服务增强

- [x] 10.1 以 macOS 主机名初始化可编辑设备名称，并通过 Core 状态和配置迁移测试验证旧配置无损升级。
- [x] 10.2 显示当前 Tailscale 节点详情及 tailnet 设备列表，并通过 LocalAPI 状态 fixture 验证名称、DNS、IP、用户、tailnet 与在线状态。
- [x] 10.3 实现用户可添加、编辑、删除和共享的 loopback HTTP 服务，拒绝非 loopback/非 HTTP 目标，并测试端口分配、探测、发布和持久化。
- [x] 10.4 让远端 manifest、动态映射和 UI 支持任意已配置服务，并通过先添加设备后启用服务的刷新测试验证无需重新添加设备。
- [x] 10.5 实现 DSH Web 认证 URL 的会话内提示、校验与映射 URL 转换，确保 token 不持久化并验证错误恢复。
- [x] 10.6 使用紧凑 macOS 控件完成设备详情、tailnet 列表、服务管理和认证界面，先运行功能测试，再构建并安装到 一台远程 Mac。
- [x] 10.7 使用 NSH Tailwind 统一控制台视觉，提供设备、持久当前服务和设置图标导航；通过状态机测试验证切页不释放映射，并将 Tailscale 注册名修改与 DSH 可选认证流程部署到 一台远程 Mac。

## 11. PC 桌面界面全面重构

- [x] 11.1 重建视觉 token：使用 4pt 基线、13pt 主体、独立 Canvas/Surface/Sidebar/Border/Accent/Success/Warning/Danger/Offline 明暗色，并将窗口设为 16:9 的首次 `1280x720`、最小 `960x540`；通过 token、对比度和窗口布局测试。
- [x] 11.2 重建应用 Shell：使用 NSH/macOS 系统默认标题栏和原生窗口拖动，固定 56pt 图标导航位于标题栏下并只包含设备、已打开服务和设置；不自绘标题栏、不提供侧栏展开，详情操作位于内容区首行。
- [x] 11.3 重建设备列表与详情：列表按“这台 Mac/其他设备”分区，添加设备位于其他设备 section；点击后在同一内容区切换为单一详情，移除双栏、压缩表格、嵌套卡片和 Route Line，并保留独立删除、状态和错误恢复操作。
- [x] 11.4 重建本机服务与设置：服务使用稳定列与上下文菜单表达名称、URL、可用和共享状态；设置使用 Preferences 风格分组行，正常在线状态只在设备详情/设置展示，异常才在设置导航显示 badge。
- [x] 11.5 重建已打开服务列表和工作区：服务导航始终可达并先显示独立列表，点击条目才进入对应持久 WebView；保持多个映射与 WebView，关闭动作独立；移除顶部 tabs、二级 header、浏览器工具栏和重复在线状态。
- [x] 11.6 重建桌面 Form Sheet：添加设备使用 640x520 Tailnet `List` + 手动输入并支持键盘选择/提交；添加服务使用 OpenCode、DSH、自定义 HTTP 预设选择；统一字段、错误、加载和按钮布局，不使用 mobile Card/Group/ListView/Button/Sheet/Stack。
- [x] 11.7 完善 AppKit 桌面控件和可访问性：区分 primary/secondary/plain/danger，增加 popup/menu、tooltip、focus ring、非颜色状态、长文本截断和独立点击目标；通过键盘、焦点、空/加载/错误状态模型测试。
- [x] 11.8 运行 Go race、Rust tests/clippy、NSH typecheck/release build、UI 状态测试和签名验证；在本机功能验收后备份并更新 远程 Mac 的 `/Applications/Vela.app`，不使用截图或视觉基线作为验收。
- [x] 11.9 按页面语义重建宽度规则：设备列表、详情与设置流式占满 PC 内容区，已打开服务列表使用居中 `760–840pt` 内容列，WebView 占满剩余空间，空状态作为页面直接 `flex-1` 子视图双向居中；将添加设备、设备改名、添加/编辑服务和 DSH 认证统一为固定 Header、伸缩 Body、底部 Footer 三段式 Form Sheet，并通过结构、类型、构建和签名测试后更新双机应用。

## 12. 外观、可观测性与调试

- [x] 12.1 实现浅色、深色与跟随系统三种外观：设置页提供选择，使用 NSH `setColorScheme` 立即生效，并持久化到 Core 配置以便下次启动恢复；通过配置迁移与外观状态测试验证。
- [x] 12.2 在 Core 中实现有界内存日志缓冲和 `diagnostics.logs` 命令，记录连接、认证、共享、映射与代理错误事件，并保证认证 URL、token、Cookie 和业务内容不进入缓冲；通过脱敏与容量淘汰测试验证。
- [x] 12.3 在 Core 中暴露 `diagnostics.activity`：按设备与服务汇总当前映射、引用计数、活跃连接数、最近错误和远端 manifest 探测结果；通过并发打开/关闭映射测试验证计数正确。
- [x] 12.4 在设置页新增“诊断”区域，显示实时连接与请求活动、日志列表、刷新与复制操作，并保持脱敏；通过状态 fixture 与空/错误状态测试验证。
- [x] 12.10 修复宿主协议词汇表缺少 `preferences.update`、`diagnostics.logs` 与 `diagnostics.activity` 导致请求被 Rust 宿主拒绝的缺陷，并增加 Rust 与 Go 词汇表一致性测试。
- [x] 12.11 按归属重排诊断信息：连接活动移入对应设备详情，运行日志改为独立一级页面，设置只保留偏好、共享与调试；通过结构与导航测试验证。
- [x] 12.12 为每个“设备 + 服务”分配稳定并持久化的本地映射端口，使重新打开服务与重启应用后 origin 不变、Cookie 与 localStorage 登录态保留；端口被占用时回退重新分配并更新记录，并通过端口复用、冲突回退和配置迁移测试验证。
- [x] 12.5 增加调试选项：设置页可开启 NSH 性能 HUD（`AppView::set_fps_monitor`）和 Core 详细日志级别，默认关闭且持久化；通过宿主桥接与配置测试验证开关生效。
- [x] 12.7 修复活动连接只匹配本机服务的缺陷：活动快照必须以当前实际映射为准，覆盖远端 manifest 提供的服务，并显示设备、服务、映射地址与引用计数；通过远端服务映射测试验证。
- [x] 12.8 扩大日志覆盖范围：认证状态变化、远端刷新与兼容性失败、服务探测状态变化、共享发布与代理错误都必须写入脱敏日志；通过各失败路径测试验证。
- [x] 12.9 修正设置页行为：外观与调试开关切换不得重建整页状态或丢失诊断数据，切回设置页必须保持当前选择；通过偏好与诊断状态测试验证。
- [x] 12.6 运行 Go race、Rust tests/clippy、NSH typecheck/release build、UI 测试和签名验证，并在本机验收后更新 远程 Mac 的 `/Applications/Vela.app`。
- [x] 12.13 以系统浏览器取代内置 WebView：移除 `isolated_webview.rs` 与工作区挂载，转发改为长期开关并新增转发页面，映射地址交由默认浏览器打开并可复制；通过结构测试与运行验证。
- [x] 12.14 为每个“设备 + 服务”派生 `<service>-<device>.localhost` 映射主机名，使共享的系统浏览器按 host 隔离 Cookie；放宽 DSH adapter 的 loopback authority 校验以接受该子域，并通过隔离、确定性与解析测试验证。
- [x] 12.15 按工具定位重做视觉与窗口：窗口改为 `480×720` 竖向工具窗、转发行纵向堆叠、Form Sheet 不超过窗口宽度；配色改为暖白纸面 + 单一赭色强调，并引入 shadcn 式配对语义 token 与基础组件层，消除视图中的硬编码色值。
- [x] 12.16 修复浅色模式下导航图标不可见：`plain` variant 显式指定 tint 而不继承系统标签色，并新增导航与画布色阶上下界断言防止回归。
- [x] 12.17 修复 NSButton 文字标题不跟随 variant 着色：标题改由 `attributedTitle` 绘制并在 title 变化后重新套用，图标按钮跳过着色以免 `imagePosition` 被重置为图标加文字。
- [x] 12.18 修复派生自 props 的值被求值为常量导致状态不刷新（首次进入设备列表停留在“需要连接”）：改回 getter，并新增结构断言禁止在组件体内常量化 props 派生值。
- [x] 12.19 窗口改为固定尺寸 `480×960`：移除 `Resizable` 与最小尺寸、钉住内容尺寸、隐藏失效的最大化按钮，菜单移除缩放与全屏。
- [x] 12.20 设置页默认展示脱敏诊断摘要，并保留等效的复制动作；新增摘要投影纯函数与测试。
- [x] 12.21 身份与偏好分离：登录、账户、tailnet 身份独立为账户页（`⌘4`），设置只保留外观、共享、调试与诊断，设备详情不再重复身份；日志、账户与设置置于导航底部。
- [x] 12.22 按 480pt 固定窗口重标间距：页面边距 24→16pt、section 间距 28→20pt，行内边距与 56pt 行高保持 macOS 惯例；通过实测文本宽度与结构断言验证。

## 13. UI 分层重构与设计规范统一

- [x] 13.1 抽出数据层 `ui/core/client.ts` 与 `ui/core/store.ts`：统一 Core request、响应解析与错误归一，集中状态与轮询；`App.tsx` 不再直接调用 `CoreBridge` 或 `JSON.parse`。
- [x] 13.2 扩充原子组件层：新增 `page.tsx`（Page / PageHeader）、`alert.tsx`、`callout.tsx`、`card.tsx`（Card / CardHeader / CardContent / CardFooter）、`list.tsx`（List / ListRow）、`log-list.tsx`、`field.tsx`、`switch.tsx`、`sheet.tsx`、`separator.tsx`，统一由 `tokens.ts` 取色；原子组件不得依赖数据层或业务组件。
- [x] 13.3 新增禁用态与提示语气 token，并实测断言：禁用按钮标题对其底色不低于 4.5:1，四种 Alert 语气的文字对各自底色不低于 4.5:1。
- [x] 13.4 修复 `primary` 按钮禁用态不可读：改用独立禁用底色与墨色，不再依赖 AppKit 对彩色 bezel 降透明度。
- [x] 13.5 拆出业务组件 `ui/features/{devices,forwards,logs,account,settings}`，仅拼装原子组件并读数据层；不得出现十六进制色值、`dark:` 变体或 padding 字面量。
- [x] 13.6 所有一级页面与对话框改用统一 `Page` / `PageHeader` / `FormSheet`，消除三种页头写法与两种间距节奏；设备页补齐结构标识使其纳入测试覆盖。
- [x] 13.7 收敛为单一 `ListRow` 实现并覆盖全部页面：设备列表、设备详情、转发、账户与设置页的数据行都改用 `Card` + `ListRow`，消除 7 种行实现与 5 种行高（含 `App.tsx` 与 `primitives.tsx` 的重复副本），并断言不存在页面级自绘行高。
- [x] 13.8 设备列表行移除行内删除按钮，整行可点进入详情，行宽改为展示状态、可用服务数与完整 IPv4/IPv6 地址；删除改由上下文菜单与详情页提供并保留确认。
- [x] 13.9 移除与文字同义的状态色点，使一项状态只呈现一次，且不仅依赖颜色；包括设备详情与账户页“状态”行中 `detail` 文字与 `StatusMark` 的重复。
- [x] 13.10 新增 `NSSwitch` 原生开关并替换四处“状态文字 + 反向按钮”组合（共享这台 Mac、每个本地服务、性能 HUD、详细日志）；说明文字改为描述开关作用，动作与只读事实保持原有控件。
- [x] 13.11 将平铺的提示长文本替换为 `Alert` 与 `Callout`。
- [x] 13.12 重做运行日志：新增 `LogList` 以等宽本机时间、语义色等级与完整消息三列呈现，支持按等级筛选；替换把消息降级为次要文字的数据行投影，并补充投影纯函数测试。
- [x] 13.13 重写结构测试以匹配分层：保留原有每条约束的语义，补充分层依赖方向、业务组件禁止硬编码样式、`App.tsx` 行数与单行长度上限的断言。
- [x] 13.14 重构前后各运行一次完整 release gate 并比对结果，确认行为无回归，然后更新两台 Mac。

## 14. 多协议服务：HTTP 与 TCP

- [x] 14.1 Core 配置与校验：`LocalService` 新增 `protocol`（`http` | `tcp`），缺省迁移为 `http`；TCP 目标以 `host:port` 校验且只允许 loopback；补充迁移、拒绝非 loopback 与端口范围测试。
- [x] 14.2 TCP 健康探测不建立连接：非特权端口以不带 `SO_REUSEADDR` 的绑定判断 `EADDRINUSE`，特权端口读取系统监听表；HTTP 服务保持现有探测；测试覆盖 `127.0.0.1` / `0.0.0.0` / `[::]` 三种监听与特权端口，并断言探测期间目标未收到连接。
- [x] 14.3 清单协议化：manifest 服务新增 `protocol`，清单版本升至 `2`；Rust 与 Go 两侧协议词汇与版本一致性测试同步更新；旧版本清单返回不兼容。
- [x] 14.4 预设按协议分组：Web 服务（OpenCode、DSH、ComfyUI、自定义 HTTP）与 TCP 服务（SSH、Redis、MySQL、PostgreSQL、自定义 TCP）；TCP 表单以 `host:port` 替代 URL；SSH 首次共享的确认文案单独说明命令行权限与远程登录前提。
- [x] 14.5 访问端按协议提供访问方式：HTTP 交给默认浏览器；TCP 显示可复制的 `host:port` 与客户端连接命令，不提供“在浏览器中打开”；MySQL 命令使用 `127.0.0.1`。
- [x] 14.6 文档：用户指南补充 TCP 服务、各预设连接命令、`~/.ssh/config` 示例、远程登录前提与 ComfyUI `--listen 127.0.0.1` 安全提示；`sharing-and-dsh.md` 补充 TCP 安全边界。
- [x] 14.7 真实验证：在 Mac mini 上通过转发访问 ComfyUI（含 WebSocket 进度与工作流提交）与至少一个 TCP 服务，并确认 TCP 探测期间目标服务未记录任何连接。
  - 2026-10-22 跨机实测（Mac Studio → Mac mini，经 tailnet 转发）：ComfyUI 已通过。`/system_stats` 200、`/object_info` 1.99 MB 用时 0.18s、WebSocket `/ws` 握手 101 并收到首个 `status` 帧；同源提交 `/prompt` 进入 ComfyUI 业务校验，`Sec-Fetch-Site: cross-site` 请求仍被 ComfyUI 拒绝（403），说明来源检查未被绕过。2026-10-23 用户在 Mac mini 共享 SSH 预设，从 Mac Studio 经转发登录成功，TCP 跨机转发验证通过。
- [x] 14.8 连接命令按服务类型而非名称选择客户端：Core 在配置与清单中保留预设类型，UI 按稳定预设生成连接命令；服务改名不改变 SSH、Redis、MySQL 或 PostgreSQL 的客户端命令。
- [x] 14.9 转发行重做为“开关 + 端点块”：开关取代开始/停止按钮，地址以 `host:port` 显示在独立内凹块中并完整可读，链路指示为唯一状态标记，操作收为标题行的打开与复制两个图标；设备详情与转发页共用 `ForwardRow`；关闭开关可撤销进行中的连接；通过实测宽度与结构断言验证。
- [x] 14.10 运行中被后台删除的设备经“重新检查”即显示需要连接：`auth.reconnect` 重建控制客户端使节点重新登录，`Running` 但带待处理认证地址视为需要连接；实测已删除身份返回 needs-auth 与新认证地址，健康节点（Mac mini）保持 connected。
