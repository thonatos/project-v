# Tasks

## 1. 工程骨架与风险验证

- [ ] 1.1 建立 Vela 的 NSH UI、Rust macOS 宿主、Go Core、共享协议与测试目录，并通过工作区构建命令验证各空模块可独立编译。
- [ ] 1.2 锁定 NSH、Go、Tailscale/tsnet 及 Rust 依赖的精确版本，记录 macOS 14+ 与构建工具要求，并验证干净环境可以解析全部依赖。
- [ ] 1.3 制作 NSH macOS WebView 能力 spike，验证 Cookie、SSE、WebSocket、上传下载和 Web 数据域隔离；若内置 WebView 不能隔离数据域，则交付 Rust 原生 WKWebView component 原型并以两个同名 Cookie 测试证明隔离成立。
- [ ] 1.4 定义 `Vela.app` 目录、Bundle ID、Application Support/Logs 路径与进程权限边界，并通过路径单元测试确认所有可写数据均位于用户目录而非 App Bundle。

## 2. Core 控制协议与持久化

- [ ] 2.1 定义版本化 JSON Lines 请求、响应、事件、状态和结构化错误 schema，并通过 Go 与 Rust 的双向 fixture 测试验证兼容解析、未知版本和未知消息拒绝行为。
- [ ] 2.2 实现 Go Core 的 stdin/stdout 控制循环和独立 stderr 日志，覆盖快照、事件订阅与 shutdown，并通过进程测试验证日志不会污染协议流。
- [ ] 2.3 实现 Rust Core supervisor 和 typed NSH native module，覆盖请求关联、事件分发、Core EOF、有限退避重启与退出期间禁止重启，并通过伪 Core 集成测试验证全部状态转换。
- [ ] 2.4 实现远程 Mac、共享选择和最近连接状态的原子配置存储，并通过中断写入、损坏文件降级和并发更新测试验证不会产生部分配置。
- [ ] 2.5 编写控制协议与数据目录开发文档，并以文档中的示例消息运行协议 fixture 校验。

## 3. 私人网络与身份

- [ ] 3.1 在 Go Core 中创建单一持久化 tsnet node，明确禁用 exit node、subnet route 和 TUN 路径，并通过启动测试与系统网络配置快照验证 Vela 不修改代理、DNS 或路由。
- [ ] 3.2 实现交互认证 URL、连接状态、身份恢复、重新认证和注销命令，并通过测试 tailnet 验证首次登录、重启免登录和设备撤销后的 `needs-auth` 状态。
- [ ] 3.3 实现网络中断与接口变化后的有界自动重连和手动重试，并通过网络故障注入测试验证 `connecting/connected/offline/needs-auth` 事件顺序。
- [ ] 3.4 实现远端连接 WhoIs 与本机授权策略接口，默认限制为当前用户并保留设备 allowlist 扩展点；通过授权和未授权 node 测试验证拒绝发生在连接本地目标之前。
- [ ] 3.5 增加私人网络日志脱敏规则和状态诊断快照，并通过 fixture 验证认证 URL、密钥、Cookie、Authorization header 和业务内容不会进入复制诊断结果。

## 4. 本机服务共享

- [ ] 4.1 实现 OpenCode V2 `127.0.0.1:49374` 与 DSH `127.0.0.1:3080` 的独立健康探测及周期刷新，并通过可用、拒绝连接、超时和错误响应测试验证状态分类。
- [ ] 4.2 实现“共享这台 Mac”总开关和 OpenCode/DSH 分项选择，使 listener 仅在网络已连接、总开关开启、服务已选且可用时发布；通过状态矩阵测试验证关闭共享不影响远端访问能力或本地服务进程。
- [ ] 4.3 实现固定 Vela 控制端口及 `/vela/v1/manifest`、`/vela/v1/health`，并通过契约测试验证清单不泄露本机 target、不发布禁用服务且正确拒绝不兼容版本。
- [ ] 4.4 实现 OpenCode 与 DSH 的独立 tailnet TCP listener 和流式双向代理，覆盖半关闭、背压、长空闲连接和 listener 关闭；通过 HTTP、SSE、WebSocket、上传与下载集成测试验证不缓冲完整响应。
- [ ] 4.5 实现服务 adapter 的 Host/Origin/Cookie/Upgrade 策略，默认透明且仅对已验证兼容问题做定向处理；通过 OpenCode 配对和 DSH trusted-host fixture 验证不会绕过目标服务认证或接受未知代理目标。
- [ ] 4.6 编写本机共享安全边界与 DSH authority 配置说明，并按文档从默认 loopback 服务完成一次手动配置验证。

## 5. 远程设备与本地映射

- [ ] 5.1 实现通过私人名称添加、校验、保存、刷新和移除远程 Mac，并通过在线、离线、名称无效、未授权和协议不兼容测试验证记录创建规则与错误反馈。
- [ ] 5.2 实现远端 manifest 客户端和服务状态缓存，并通过模拟远端状态变化测试验证只呈现兼容且当前共享的 OpenCode/DSH。
- [ ] 5.3 实现按“远端设备 + 服务”创建的 IPv4/IPv6 loopback 临时 listener、运行期稳定映射和引用计数关闭，并通过端口占用与非 loopback 绑定检查验证隔离。
- [ ] 5.4 实现本地映射到远端 Vela listener 的 tsnet 拨号和透明 TCP 复制，并通过断线、重连、并发连接、半关闭及长连接测试验证资源正确释放。
- [ ] 5.5 实现映射打开、关闭与状态事件的 Core 协议命令，并通过 Rust-Go 集成测试验证 UI 获得可加载的本地 URL且错误不会退化为空白状态。

## 6. Rust macOS 宿主与应用生命周期

- [ ] 6.1 创建自定义 NSH macOS runner，设置初始/最小窗口尺寸、自定义标题栏和 `keep_alive_on_close`，并通过 UI smoke test 验证红色关闭和 `Cmd+W` 仅隐藏窗口。
- [ ] 6.2 实现 Dock 激活恢复现有窗口、NSH bundle 重载不重启 Core 和窗口状态同步，并通过 PID/连接计数断言验证隐藏与恢复期间 Core 身份不变。
- [ ] 6.3 配置原生 Vela、File、Edit、View 和 Window 菜单及标准快捷键，并通过菜单 UI 测试验证 `Cmd+,`、`Cmd+W`、侧栏切换、刷新、全屏和 WebView 按键优先级。
- [ ] 6.4 实现应用级 process activity，使窗口隐藏时 Core 可继续服务但不阻止整机睡眠，并通过窗口隐藏后的远端健康请求验证共享持续可用。
- [ ] 6.5 实现 `Cmd+Q`、应用菜单退出和 Dock 退出的有界优雅清理，先停接入和映射再关 tsnet/Core，超时则终止 helper；通过活动连接退出测试验证 App 在期限内结束且 helper 不残留。

## 7. NSH 设备中心界面

- [ ] 7.1 实现 Fog/Panel/Ink/Slate/Route/Caution 颜色、SF 系统字体、8pt 间距和明暗模式 token，并通过浅色、深色与增大对比度截图审查验证无未定义视觉值和文本对比问题。
- [ ] 7.2 实现自定义标题栏、228pt 设备侧栏、底部私人连接状态和响应式主面板，并在 `1080x720` 与 `820x560` 下运行截图测试验证无裁切或重叠。
- [ ] 7.3 实现“这台 Mac”和“我的 Mac”的统一设备导航、添加/移除 Mac 流程及在线/离线状态，使用用户文案而非内部网络术语；通过键盘导航测试验证焦点、选择和错误恢复。
- [ ] 7.4 实现本机共享页面，包括总开关、固定服务状态、分项开关、安全确认和再次检查，并通过 Core mock 状态矩阵测试验证所有开关和不可用状态。
- [ ] 7.5 实现远程设备概览、服务行、最近连接、离线和协议不兼容界面，并通过 mock fixture 截图验证每种状态都包含文字、非颜色提示和可执行操作。
- [ ] 7.6 实现 Vela Route Line 的在线、连接中、离线与服务分支状态，支持减少动态效果，并通过状态截图和 reduce-motion 测试验证图形与文字一致。
- [ ] 7.7 实现首次认证、本机服务发现和添加远端 Mac 的非模式化 onboarding，并通过全新数据目录 UI 测试验证流程不会要求选择 Host/Client 模式。
- [ ] 7.8 实现 General、Private Network、Sharing 和 Diagnostics 设置页以及脱敏诊断复制，并通过 `Cmd+,` 和内容 fixture 测试验证设置可达、保存生效且敏感字段不出现。

## 8. 服务工作区

- [ ] 8.1 实现服务焦点模式，打开服务时隐藏侧栏并显示返回设备、前进、后退、刷新、设备/服务标题和连接状态；通过导航 UI 测试验证返回后恢复此前设备上下文。
- [ ] 8.2 为每个“设备 + 服务”配置独立持久化 Web 数据域，并通过 OpenCode/DSH 同名 Cookie 与应用重启测试验证登录状态隔离和持久化。
- [ ] 8.3 接入 Core 本地映射 URL，处理加载、连接中、离线、认证和映射失败覆盖层，并通过故障注入 UI 测试验证不会显示无说明的空白 WebView。
- [ ] 8.4 验证 OpenCode V2 首页、一次性配对、30 天会话 Cookie、消息事件、工具权限、SSE 和 PTY WebSocket；将自动化契约测试与已验证版本记录随 adapter 一并提交。
- [ ] 8.5 验证 DSH token/Cookie、trusted-host、RPC、WebSocket、插件资源、上传和下载；将 authority 拒绝诊断与自动化契约测试随 adapter 一并提交。
- [ ] 8.6 验证 WebView 键盘、触控板前进后退、文件选择和下载体验，并通过 macOS UI 测试确认 Vela 快捷键不会抢占 OpenCode/DSH 页面输入。

## 9. App 组装与集成验证

- [ ] 9.1 实现可重复构建脚本，依次构建 Go helper、Rust/NSH runner 与 TSX bundle并组装 `Vela.app/Contents/Helpers/vela-core`，通过全新输出目录构建验证无手工步骤。
- [ ] 9.2 实现开发期嵌套签名流程并验证 helper、外层 App、Bundle ID、Info.plist、图标和最低系统版本；通过 `codesign --verify --deep --strict` 及实际启动 smoke test 验证产物。
- [ ] 9.3 在两台真实 Mac 上验证一台同时共享和访问另一台，覆盖 OpenCode/DSH 并发、直接/DERP 连接、断网恢复、窗口隐藏和 Core 崩溃恢复，并保存不含敏感数据的验收记录。
- [ ] 9.4 运行协议、Go、Rust、NSH UI、契约和端到端测试套件以及 lint/typecheck/build，修复全部失败并记录一条可复现的发布前验证命令。
- [ ] 9.5 完成 Vela 用户文档，覆盖首次连接、共享这台 Mac、添加远端 Mac、OpenCode 配对、DSH authority、退出语义、故障排查和卸载回滚，并逐条执行文档步骤验证结果。

## Workflow follow-up

- 实现与评审完成后归档该变更，并将四项 Vela 能力同步为主规格。
- iOS 客户端作为后续独立变更提出，复用本变更定义的 Vela Host 合约，而不修改 macOS 客户端的长期产品定位。
