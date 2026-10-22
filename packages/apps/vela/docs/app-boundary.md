# Vela macOS 应用边界

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

## 可写数据

```text
~/Library/Application Support/Vela/
  config.json
  network/
  web-data/
~/Library/Logs/Vela/
```

- `config.json`：远程 Mac 与共享选择，不存储服务密码、Cookie 或长期 Tailscale auth key。
- `network/`：嵌入式 Tailscale node 身份和状态。
- `web-data/`：每个设备与服务的 WebKit profile 元数据；实际 WebKit store 由系统管理。
- `Logs/Vela/`：脱敏后的 Core 诊断日志。

Rust 与 Go 都提供路径契约单元测试，确保这些目录不位于 `.app` 内。

## 进程权限

`Vela` 和 `vela-core` 均以当前登录用户运行，不请求 root，不安装 LaunchDaemon、Network Extension 或 TUN，不写系统代理、DNS、路由或 OpenCode/DSH 配置。Core 只能连接预定义 loopback 服务，并由 Rust 父进程通过管道管理生命周期。
