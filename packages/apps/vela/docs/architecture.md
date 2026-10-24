# Vela 架构与边界

## 进程与包

```text
macos/host (Rust)  --stdin/stdout-->  core/cmd/vela-core
                                        └── internal/app      探测、发布、共享、服务编辑
                                              └── internal/vela   读侧 Core（状态、映射、认证、远端、诊断）

ios/host (Rust)  --C ABI-->  core/cmd/vela-mobile
                              └── internal/iosabi   C ABI 管道
                                    └── internal/vela   同一份读侧 Core
```

`internal/vela` 只读、无发布副作用；`internal/app` 是 macOS 专属编排，iOS 构建不得链接它（`scripts/verify-ios-deps.sh` 强制）。两个入口共用同一套控制协议与读侧实现。

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

## 进程权限

`Vela` 和 `vela-core` 均以当前登录用户运行，不请求 root，不安装 LaunchDaemon、Network Extension 或 TUN，不写系统代理、DNS、路由或 OpenCode/DSH 配置。Core 只能连接预定义 loopback 服务，并由 Rust 父进程通过管道管理生命周期。

## 调试开关

`macos/host/src/runner/smoke.rs` 只在显式设置 `VELA_LIFECYCLE_SCRIPT` 或 `VELA_UI_SMOKE` 时运行自动化操作序列；未设置时生产启动路径只经过一次环境变量检查，不进入 smoke 代码。诊断信息通过控制协议的 `diagnostics.*` 读取，不得通过解析日志推导状态。
