# Proposal

## Why

开发者需要在不启用系统级 VPN、不改变全局代理、DNS 或路由的前提下，从另一台 Mac 私密访问常驻 Mac mini 上的 OpenCode V2 Web 与 DSH Web。Vela 将把本机共享和远程访问统一到一个低心智负担的 macOS 应用中，并以 NSH 构建符合 macOS 使用习惯的设备中心界面。

## What Changes

- 新增单一 `Vela.app`，同一应用可同时共享本机服务和访问其他 Vela Mac，不向用户暴露互斥的“服务端/客户端模式”。
- 新增进程内隔离的私人网络能力，仅让 Vela 明确建立的连接进入 tailnet，不创建 TUN、不修改系统网络配置。
- 新增本机 OpenCode V2 与 DSH 探测和共享能力；Vela 仅代理已运行且绑定 loopback 的服务，不负责启动或停止它们。
- 新增远程 Mac 管理和服务访问能力，通过 Vela 自己的 loopback 映射在内置 WebView 中透明支持 HTTP、Cookie、SSE 与 WebSocket。
- 新增以设备为中心的 NSH macOS 界面，包括设备侧栏、本机共享页、远程服务页、专注式 WebView 工作区、设置、诊断与明确的故障恢复操作。
- 新增常驻生命周期：关闭窗口或按 `Cmd+W` 仅隐藏窗口，Dock 重新激活时恢复；只有 `Cmd+Q`、应用菜单退出或 Dock 退出才停止连接并终止应用。
- 首版固定支持 OpenCode V2 与 DSH，不提供任意端口共享、服务进程管理、iOS 客户端或公网隧道。

## Capabilities

### New Capabilities

- `vela-private-network`: Vela 设备建立隔离的私人连接、维护设备身份并验证远端调用方的行为。
- `vela-service-sharing`: Vela 探测并向授权设备共享本机已运行的 OpenCode V2 与 DSH 服务。
- `vela-remote-access`: Vela 管理远程 Mac，并在应用内可靠访问其 OpenCode V2 与 DSH Web 服务。
- `vela-macos-experience`: Vela 的统一设备模型、NSH macOS 界面、窗口生命周期、菜单和可恢复状态行为。

### Modified Capabilities

无。

## Impact

- 新增 Vela macOS 应用代码、NSH TSX 界面、Rust macOS 宿主和 Go 网络辅助进程。
- 新增 `tsnet`/Tailscale、NSH macOS runtime、AppKit/WebKit 集成及对应构建依赖。
- 新增 Vela 控制协议、远程服务清单和版本化接口；不修改 OpenCode V2 或 DSH 源码。
- 应用包需要包含并签名辅助二进制；Tailscale 身份状态保存在用户的 Application Support 目录。
- 首版以 macOS 14+ 为运行基线，并需要验证 OpenCode/DSH 的配对、Cookie、SSE、WebSocket、Host 与 Origin 行为。

## Rollback Plan

- Vela 不接管 OpenCode V2、DSH 或系统网络配置，回滚时退出并移除 `Vela.app` 即可恢复到原有本机访问方式。
- 停止共享会关闭 Vela 的 tailnet listener 和本地映射，但不会停止或修改 OpenCode V2 与 DSH。
- 用户可单独删除 Vela 的 Application Support 数据以撤销本机嵌入节点身份；已有 OpenCode/DSH 数据和配置保持不变。
