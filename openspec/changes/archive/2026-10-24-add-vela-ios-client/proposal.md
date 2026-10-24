# Proposal

## Why

macOS 版 Vela 已能共享 Mac mini / Studio 上常驻的 OpenCode V2 与 DSH，但用户在手机上只能靠记忆手动输入地址，既没有身份与授权链路，也无法隔离两台设备上同名服务的登录态。iOS 客户端只需成为这些共享服务的访问方：不共享本机能力、不修改系统网络配置。

## What Changes

- 新增 Vela iOS 应用，只承担访问侧能力：加入同一私人网络、读取远端 Vela 的版本化服务清单、访问被共享的 HTTP 服务。
- Go Core 以静态库（c-archive / xcframework）内嵌进 App 进程，使用 `tsnet` 仅 `Dial`，不 `Listen`、不发布服务；共享侧能力（`publication`、`sharing`、`inbound`、`authorization`、`services` 探测）不参与 iOS 构建。
- iOS 宿主采用 NSH 嵌入模式（Xcode 工程 + `nsh-platform-ios` 的 `AppView`），而不是 `nsh package` 独立 App 模式：需要注册自定义 WKWebView 原生组件、控制 Info.plist 的 ATS 例外、并使用 `isInspectable` 调试内嵌页面。
- 浏览方式改为应用内 WebView（与 macOS 的系统浏览器方案相反），因为 App 进入后台后 loopback 监听会被系统挂起；每“设备 + 服务”使用独立的 `WKWebsiteDataStore`，访问地址为 `http://127.0.0.1:<stable port>`，不依赖 `<service>-<device>.localhost`。
- 新增面向 iPhone 的页面：服务列表（跨设备扁平）、服务舞台（常驻 WebView）、设备清单、设置与诊断；iPad 只要求兼容运行，不做专门布局。
- 新增会话级生命周期：前台建立映射，进入后台释放 loopback 监听，回到前台重建并保留当前服务。
- 明确非目标：iOS 不共享本机服务、不提供 TCP 转发（无 `ssh`/数据库客户端场景）、不做多标签、不自动更新、不通过 App Store 分发（自用开发签名）。

## Capabilities

### New Capabilities

- `vela-ios-access`: iOS 设备加入私人网络、发现远端 Vela 共享服务、在应用内浏览服务内容，并在多设备同名服务之间隔离登录态与会话生命周期。

### Modified Capabilities

无。macOS 侧的 `vela-private-network`、`vela-service-sharing`、`vela-remote-access`、`vela-macos-experience` 行为不变；iOS 只是消费既有 Host 合约的新客户端。

## Impact

- 新增 `packages/apps/vela/ios`（Xcode 工程、Info.plist/entitlements、Rust `vela-ios-native` crate）与 `packages/apps/vela/ui-ios`（TSX 入口与移动端原子层）。
- 新增 `packages/apps/vela/core/mobile`：Go `package main` + `//export` 的 c-archive 入口，复用现有 `network`、`mappings`、`tunnel`、`adapters`、`manifest`、`remoteclient`、`config`、`control`。
- 新增共享 TS 层（控制协议类型、视图模型、RPC 信封），供 macOS 与 iOS 两端复用；`Cargo.toml` workspace 增加 iOS crate 成员。
- 依赖新增：`nsh-platform-ios`、Go 静态库链接、自定义 WKWebView 原生组件；不新增系统 VPN、网络扩展或全局代理。
- 不修改 OpenCode V2、DSH 与 macOS 端 Vela 的实现。

## Rollback Plan

- 删除 iOS target 与 `ui-ios`/`ios`/`core/mobile` 目录即可回到仅 macOS 的状态；macOS 构建与发布流程不受影响。
- iOS 设备在私人网络中产生的节点身份可从 tailnet 中移除；删除 App 即清除本地 `network/` 状态。
- 远端 Mac 的共享开关无需改动：关闭“共享这台 Mac”或对应服务即可立即切断 iOS 的访问路径。
