# Tasks

> 前置条件：`upgrade-nsh-to-0-2-0` 已完成并归档。若升级延后，1.x–4.x 可先用 `nsh-platform-ios 0.1.1` 进行，但 6.x 的开关控件需要先自绘。

## 1. Go Core 的 iOS 形态

- [x] 1.1 新增 `core/mobile/main.go`（`package main` + `//export`：`vela_core_start`、`vela_core_request`、`vela_core_drain_events`、`vela_core_open_external`、`vela_core_stop`），验证：`GOOS=ios GOARCH=arm64 go build -buildmode=c-archive` 产出 `.a` 与 `.h`。
- [x] 1.2 裁剪依赖：`core/mobile` 不得 import `publication`、`sharing`、`inbound`、`authorization`、`services`，验证：新增脚本断言 `go list -deps ./mobile` 不含这些包。
- [x] 1.3 控制通道改为 `io.Pipe`：`control.Server` 在 Go 侧运行，Rust 通过 C ABI 读写，验证：Go 测试完成一次 `status.get` 往返并收到 `status` 响应。
- [x] 1.4 路径与持久化：`paths` 在 iOS 下指向 App 容器的 `Application Support/vela`，验证：单元测试断言目录与 `config.json` 位置。
- [x] 1.5 新增 `scripts/build-ios-core.sh`，产出 device 与 simulator arm64 两个 slice，验证：`lipo -info` 显示两个架构。

## 2. Rust iOS 宿主骨架

- [x] 2.1 新增 `ios/native` Cargo 成员（`staticlib`），依赖 `nsh-platform-ios`、`nsh-base`、`objc2-ui-kit`、`objc2-web-kit`，验证：`cargo check --target aarch64-apple-ios` 通过。
- [x] 2.2 实现 bootstrap（`UIApplicationMain` + `AppView::new` + `SurfaceOptions { components, .. }`），验证：模拟器启动后显示一个最小 TSX 页面，且 `AppView` 能加载 `bundle.nshc`。
- [x] 2.3 导出 `vela_ios_main()` 供 `main.swift` 调用，验证：Xcode 工程不写业务逻辑即可启动。
- [x] 2.4 实现 `#[native_module("vela/native")] CoreBridge`，接口与 `ui/.nsh/types/vela/native.d.ts` 一致（`protocolVersion/start/request/openExternal/drainEvents`），验证：模拟器从 TSX 调用 `status.get` 并打印响应。
- [x] 2.5 生命周期：注册 scene phase 通知，映射到 `start / suspend / resume / stop`，验证：前后台切换日志按预期出现 `suspend` 与 `resume`，且 `stop` 只在退出时出现。
- [x] 2.6 记录 S1 Go/No-Go 结论：Rust staticlib 与 Go c-archive 同二进制可运行；若不通过，切换到 `gomobile bind` 并把决策补进 `design.md`，验证：结论写入变更记录。

## 3. Xcode 工程与签名

- [x] 3.1 新增 `ios/Vela.xcodeproj`：bundle id `io.implements.vela.ios`、iOS 17 部署目标、仅 iPhone、自动签名、`main.swift`，验证：Xcode 可在真机上构建安装。
- [x] 3.2 `Info.plist` 加 ATS 例外（`NSAllowsLocalNetworking` + `127.0.0.1` 的 `NSExceptionDomains`），验证：内置 WebView 能加载 `http://127.0.0.1:<port>` 且不被 ATS 拦截。
- [x] 3.3 构建阶段脚本：`nsh build ui-ios/App.tsx --release`、`build-ios-core.sh`、`cargo build --target aarch64-apple-ios --release`，验证：Clean build 一次成功且产物齐全。
- [x] 3.4 安装与周更流程：`scripts/install-ios.sh` 使用 `xcrun devicectl device install app`，文档记录 7 天重装步骤，验证：连续两次覆盖安装后 App 可启动。
- [x] 3.5 身份保活：重装后 tsnet 节点 ID 不变，验证：设置页显示节点 ID，重装前后一致。

## 4. WebView 与数据隔离（Go/No-Go）

- [x] 4.1 实现原生组件 `vela/webview`：`source`、`dataKey`、`reload` 命令、`onLoad/onError/onNavigationStateChange` 事件，验证：TSX 能加载页面并收到事件。
- [x] 4.2 按 `dataKey` 选择 `WKWebsiteDataStore(forIdentifier:)`，验证：两台 Mac 的 OpenCode 同时登录，互不覆盖，重启后仍各自有效。
- [x] 4.3 开启 `isInspectable`（Debug）并在文档记录 Mac Safari 检视步骤，验证：Safari 能选中内嵌页面并查看控制台。
- [x] 4.4 OpenCode 契约：配对、Cookie 持久、SSE、PTY WebSocket、软键盘不遮挡输入，验证：在真机上完成一次真实会话。
- [x] 4.5 DSH 契约：`127.0.0.1` authority 归一、token URL 认证、Cookie 保留，验证：DSH 页面正常加载并通过认证。
- [x] 4.6 记录 S3 Go/No-Go 结论；若 data store 方案不可行，回退到 `127.0.0.<n>` 别名并在 `design.md` 更新，验证：结论与替代方案写入变更记录。

## 5. 访问侧 Core 行为

- [x] 5.1 设备注册与管理：私人名称、刷新清单、离线状态，验证：Go 测试覆盖在线、离线、清单版本不兼容三条路径。
- [x] 5.2 映射会话化：打开/关闭服务、稳定端口、后台释放，验证：Go 测试断言 suspend 后 listener 关闭、resume 后同端口重建。
- [x] 5.3 断线与恢复：有限次自动重试 + 手动重试，验证：Go 测试覆盖远端拒绝与恢复两种情况。
- [x] 5.4 诊断脱敏：日志不含 Cookie、token、页面内容，验证：`diagnostics` 测试用例断言脱敏结果。

## 6. iOS 界面

- [x] 6.1 抽取 `ui-shared`（协议类型、视图模型、RPC 信封）并让 macOS 侧改为引用，验证：`pnpm run test:ui-model` 与 `pnpm run check:ui` 保持通过。
- [x] 6.2 建立 `ui-ios/ui` 原子层（Page、ListRow、Sheet、Button、Switch、Alert、Callout），验证：结构测试断言不使用十六进制色值或间距字面量。
- [x] 6.3 服务列表：跨设备扁平列表 + 空状态 + 离线标记，验证：在真机上同时显示两台设备的服务。
- [x] 6.4 舞台与覆盖式导航：列表/设置以 Sheet 覆盖，舞台不卸载，验证：返回列表再进入同一服务时不重新加载。
- [x] 6.5 设备页与设置：认证、节点身份、签名到期时间、诊断复制，验证：真机上信息与实际一致。
- [x] 6.6 错误与恢复提示：离线、需要认证、服务不可用三种状态，验证：断网与远端关闭共享时分别显示对应提示。
- [x] 6.7 iOS 主题断言：对比度与状态色测试，验证：新增的移动端 token 测试通过。

## 7. 验收与文档

- [x] 7.1 `scripts/build-ios.sh` 一键产出可安装 App，验证：在干净的工作目录执行一次成功。
- [x] 7.2 编写 `docs/ios.md`：安装、7 天重装、Web Inspector 调试、常见故障，验证：按文档从零安装一次成功。
- [x] 7.3 验收清单：双设备同名服务隔离、前后台恢复、OpenCode/DSH 真实会话、断网恢复，验证：逐项在真机记录结果。

## 8. iOS UI 规范落地（重做版，见 ui-audit.md）

- [x] 8.0 与用户确认 `ui-audit.md`：列表风格、Sheet body padding、WebView 底部安全区、0 服务设备、设备改名、日志范围、菜单高度、关闭服务入口、复制提示
- [x] 8.1 统一 iOS 间距/尺寸 token，重写 Page/Sheet/ListRow/MenuRow 的 padding 规则，消除双层内边距，验证：结构测试覆盖每个容器只有一层水平内边距
- [x] 8.2 将设备/服务/用户/日志投影集中到 `ui-shared`，页面只消费，验证：iOS 页面不再手写 badge/状态文案，数据投影测试通过
- [x] 8.3 日志页对齐 macOS（等级筛选、计数、摘要、复制），验证：与 macOS 使用同一 `logRows`/`logLevelCounts`/`diagnosticSummaryRows`
- [x] 8.4 用户页对齐 macOS（MagicDNS、地址、重新检查、签名；改名视 8.0 决策），验证：字段与 macOS AccountPage 一致
- [x] 8.5 设备管理：列表/详情返回栈、兼容性/地址/连接活动、删除确认，验证：设备详情关闭回设备列表，删除后回设备列表
- [x] 8.6 服务分组：加载/空态/离线/最近/0 服务设备的展示，验证：冷启动不出现“假空态”，分组排序稳定
- [x] 8.7 设置对齐：外观（RadioGroup 或等价）、详细日志、关于；排除共享/HUD，验证：偏好即时生效并持久化
- [x] 8.8 导航壳：头像/返回/标题/更多，modal 栈与返回语义，验证：每个入口的关闭回到正确父级
- [x] 8.9 可访问性与测试：44pt 目标、标签、结构/主题/数据测试、ASCII 验收清单，验证：`test:ios` 覆盖新增规则
