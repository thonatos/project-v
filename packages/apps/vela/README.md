# Vela

Vela 让同一私人网络（Tailscale）里的设备互相访问对方 Mac 上共享的本地开发服务：桌面端负责共享、转发与诊断，iPhone 端只读浏览。两个客户端共用一套控制协议、一份 Core 实现和一层共享的界面投影。

## 目录

顶层只有四类目录，每一类只承担一种职责。

```text
packages/apps/vela/
  macos/                 平台私有：macOS 应用
    ui/                  TypeScript 界面（NSH），入口 App.tsx，配置 nsh.json
    host/                Rust 宿主（vela-host）：窗口、菜单、原生控件、子进程监督
    app/                 打包输入：Info.plist、AppIcon.icon

  ios/                   平台私有：iOS 应用
    ui/                  TypeScript 界面（NSH），入口 App.tsx，配置 nsh.json
    host/                Rust 宿主（vela-ios-native）：场景、WebView、原生控件、C ABI
    app/                 Xcode 工程与 7 行 Swift 跳板

  shared/                两端共用，不依赖任何平台目录
    ui/                  控制请求客户端、协议类型、纯投影
    protocol/            Rust 与 Go 共用的 JSON Lines fixtures
    tokens/              品牌色的唯一真源

  core/                  单一 Go 模块：读侧共享，两个平台各一个入口
    cmd/vela-core/       macOS 入口：探测、发布、共享编排
    cmd/vela-mobile/     iOS 入口：c-archive + C ABI
    internal/core/       共享读侧 Core
    internal/app/        macOS 编排
    internal/iosabi/     C ABI 桥

  scripts/  docs/        仓库工具与文档
```

依赖方向只有一种：

```text
macos/**, ios/**  ->  shared/**, core/**     允许
shared/**, core/** ->  macos/**, ios/**      禁止
macos/**          ->  ios/**                 禁止
```

`tests/structure.test.mjs` 检查 TypeScript 侧，`scripts/verify-ios-deps.sh` 检查 Go 侧。

## 平台能力

| 能力                   | macOS              | iOS                |
| ---------------------- | ------------------ | ------------------ |
| 共享本机服务、发布清单 | 是                 | 否                 |
| 转发远端服务           | 是，交给系统浏览器 | 是，应用内 WebView |
| 服务探测与编辑         | 是                 | 否                 |
| 远程 Mac 管理          | 是                 | 是                 |
| 设备重命名、登录与注销 | 是                 | 是                 |
| 日志与诊断             | 是                 | 是                 |

## 构建与验证

前置条件见 `docs/development.md`（NSH `v0.2.0`、Rust `1.98.1`、Go `1.27.2`、Xcode）。NSH 的 Rust 集成需要源码 checkout：设置 `NSH_SOURCE`，未设置时脚本回退到 `~/.nsh/source`。

```sh
pnpm -F vela build              # 界面 + 宿主 + Core
pnpm -F vela build:app          # 组装并签名 Vela.app
pnpm -F vela build:ios          # 构建 iOS App（未设置 DEVELOPMENT_TEAM 时不签名）

pnpm -F vela check              # 两端类型检查 + Go 测试
pnpm -F vela verify             # 唯一聚合验证入口
pnpm -F vela verify:release     # verify + 两端组包 + 签名
```

`verify` 的报告写入 `.tmp/release/`；`.tmp/`、`build/`、`target/` 均不进入版本控制。

## 文档

从 `docs/README.md` 进入：

| 读者     | 文档                                                                             |
| -------- | -------------------------------------------------------------------------------- |
| 使用者   | `docs/user-guide.md`、`docs/sharing.md`                                          |
| 开发者   | `docs/development.md`、`docs/architecture.md`、`docs/protocol.md`、`docs/ios.md` |
| 界面作者 | `macos/ui/LAYERS.md`、`ios/ui/LAYERS.md`                                         |
| 验收     | `docs/verification/`                                                             |
