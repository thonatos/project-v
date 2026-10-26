# Vela 架构与边界

## 进程与包

```text
macos/host (Rust)  --stdin/stdout-->  core/cmd/vela-core
                                        └── internal/app      探测、发布、共享、服务编辑
                                              └── internal/core   读侧 Core（状态、映射、认证、远端、诊断）

ios/host (Rust)  --C ABI-->  core/cmd/vela-mobile
                              └── internal/iosabi   C ABI 管道
                                    └── internal/core   同一份读侧 Core
```

`internal/core` 只读、无发布副作用；`internal/app` 是 macOS 专属编排，iOS 构建不得链接它（`scripts/verify-ios-deps.sh` 强制）。两个入口共用同一套控制协议与读侧实现。

## Bundle 结构

Vela 使用单一签名应用，网络 Core 是 App 内的辅助可执行文件：

```text
Vela.app/Contents/
  Info.plist
  MacOS/Vela
  Helpers/vela-core
  Resources/nsh/bundle.nshc
  Resources/nsh/assets/
```

Bundle ID 固定为 `io.implements.vela.macos`，最低运行环境为 macOS 14。`Contents` 下的文件属于签名产物，运行时不得修改。

打包输入存放在源码里，构建脚本只负责装配：

```text
macos/app/Info.plist          应用元数据（文件，非脚本内联）
macos/app/AppIcon.icon        Icon Composer 图标源
ios/app/Info.plist            iOS 应用元数据
ios/app/Assets.xcassets       iOS 图标资源
```

`scripts/build-app.sh` 生成 `.app` 并签名；`ios/app/Vela.xcodeproj` 由 `scripts/build-ios.sh` 驱动。

## 可写数据

```text
~/Library/Application Support/Vela/
  config.json
  network/
  web-data/
~/Library/Logs/Vela/
```

- `config.json`：远程 Mac 与共享选择，以及可选的 DSH 输出日志路径；不存储服务密码、token、Cookie 或长期 Tailscale auth key。
- `network/`：嵌入式 Tailscale node 身份和状态。
- `web-data/`：每个设备与服务的 WebKit profile 元数据；实际 WebKit store 由系统管理。
- `Logs/Vela/`：脱敏后的 Core 诊断日志。

Rust 与 Go 都提供路径契约单元测试，确保这些目录不位于 `.app` 内。

## UI 状态、主题与能力边界

- 两端 `core/store.ts` 独占可写 signals；页面只读取 accessor 并调用语义命令。关联字段用 `batch` 发布，复用或非平凡派生值使用 `computed`。
- status、远端与诊断刷新使用 revision/latest-wins，轮询、重试和反馈计时器由根 owner 统一停止。
- `nsh.json.theme` 是 TSX 与原生控件共同的运行时主题；原生颜色通过 `token()` 获取，支持 light、dark 与宿主 override。
- 两端 TSX 只声明 Clipboard；Core 通过宿主网络下载头像并返回 data URL，由 store 的只读 signal 持有并交给 NSH `Image` 加载，关闭偏好或注销后清空。`vela/native` 和自定义 WebView 是可信宿主代码，不受 TSX capability 自动约束，因此 Rust 单独校验外部 URL，并把 iOS WebView source 限制到 Core 创建的 `localhost`、`127.0.0.1` 或 `[::1]` HTTP 映射；服务发起的 HTTPS OAuth/SSO 顶层导航交给系统认证/浏览器会话，远端 HTTP 与其他 scheme 被拒绝。
- macOS 的 `tailscaleProxy` 偏好只控制独立 `vela-core` 中的 Tailscale `useproxy` feature。关闭后，host 在下次启动 helper 时设置 `TS_DISABLE_FEATURE=useproxy`；它不清除 `HTTP_PROXY`/`HTTPS_PROXY`，因此头像等非 Tailscale HTTP 请求不受影响。该设置需要重启 Vela 生效。
- 24/28/32/52/56pt 控件尺度、iOS status bar/WebView inset、日志固定列与三个固定工具窗 sheet 尺寸是集中命名且有测试覆盖的平台几何例外；feature 不得新增字面布局值。

## 进程权限

`Vela` 和 `vela-core` 均以当前登录用户运行，不请求 root，不安装 LaunchDaemon、Network Extension 或 TUN，不写系统代理、DNS、路由或 OpenCode/DSH 配置。Core 只能连接预定义 loopback 服务，并由 Rust 父进程通过管道管理生命周期。

## 调试开关

`macos/host/src/runner/smoke.rs` 只在显式设置 `VELA_LIFECYCLE_SCRIPT` 或 `VELA_UI_SMOKE` 时运行自动化操作序列；未设置时生产启动路径只经过一次环境变量检查，不进入 smoke 代码。诊断信息通过控制协议的 `diagnostics.*` 读取，不得通过解析日志推导状态。
