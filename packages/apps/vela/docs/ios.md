# Vela iOS

Vela iOS 是只读访问方：它加入与 Mac 相同的私人网络，读取远端 Vela 的服务清单，并在应用内 WebView 中打开共享的 HTTP 服务。它不共享本机服务，不建立系统 VPN，也不提供 TCP 服务入口。

## 前置条件

| 工具 | 版本 |
|---|---|
| macOS | 14 或更高 |
| Xcode | 27（iOS 27 SDK；部署目标 iOS 17） |
| NSH CLI / runtime | `v0.2.0` |
| Go | `1.27.2` |
| Rust | `1.98.1`，安装 `aarch64-apple-ios` 与 `aarch64-apple-ios-sim` |

```sh
rustup target add --toolchain 1.98.1 aarch64-apple-ios aarch64-apple-ios-sim
```

真机签名使用 Xcode 自动签名。把 Team ID 放进 `DEVELOPMENT_TEAM`，bundle id 固定为 `io.implements.vela.ios`。

## 构建

在 `packages/apps/vela` 中：

```sh
# 真机 Release
DEVELOPMENT_TEAM=ABCDE12345 sh scripts/build-ios.sh

# 模拟器
DESTINATION='generic/platform=iOS Simulator' sh scripts/build-ios.sh
```

`build-ios.sh` 会：

1. 用 `scripts/build-ios-core.sh` 生成 device 与 arm64 simulator 两个 Go slice，并封装为 `build/ios/VelaCore.xcframework`；
2. 让 Xcode 构建阶段编译 `vela-ios-native`（Rust staticlib）；
3. 用 `nsh build ui-ios/App.tsx --release` 生成 `bundle.nshc` 并复制进 `Vela.app/nsh/`；
4. 链接 Swift 壳、Rust 宿主与 Go Core。

产物在 `.tmp/ios-derived/Build/Products/<Configuration>-<platform>/Vela.app`。

只重建某一层时：

```sh
sh scripts/build-ios-core.sh            # Go Core -> build/ios
nsh build ui-ios/App.tsx --release -o build/ui-ios
cargo build --target aarch64-apple-ios --release -p vela-ios-native
```

## 安装与每周重装

免费个人团队签发的描述文件 7 天过期。到期后 App 无法启动，必须重新签名安装。**不要删除 App**：tsnet 身份在 App 容器的 `Library/Application Support/vela/network`，删除 App 会连同身份一起清掉。

```sh
xcrun devicectl list devices          # 找到 iPhone 的 identifier
DEVICE_UDID=<identifier> sh scripts/install-ios.sh
```

覆盖安装（`devicectl device install app`）保留数据容器，因此：

- tsnet 节点 ID 不变；设置页显示的名称与地址在重装前后一致；
- 已登录的 OpenCode / DSH Cookie 仍在各自的 `WKWebsiteDataStore` 中。

每周流程：

1. `DEVELOPMENT_TEAM=… sh scripts/build-ios.sh`
2. `DEVICE_UDID=… sh scripts/install-ios.sh`
3. 打开 Vela，确认设置页的「签名到期」已顺延，服务可直接打开。

若 Xcode 提示没有可用描述文件，先在 Xcode 中打开 `ios/Vela.xcodeproj`，在 Signing & Capabilities 里选择同一个 Team，并让 Xcode 自动管理签名一次。

## 首次认证

1. 打开 Vela → 设置 → 「连接私人网络」。
2. Vela 在应用内弹出 `ASWebAuthenticationSession`，显示 Tailscale 登录页；不会切到 Safari，因此登录轮询不会因进程挂起而中断。
3. 看到 “Login successful” 后点左上角 ✕ 关闭系统认证面板，回到 Vela，再点「检查连接」。设置页显示在线与节点地址后即可添加 Mac。

身份被移除或过期时，状态变为「需要连接」，再次认证即可；不需要修改 Mac 端配置，授权按同一 tailnet 用户放行。

## 添加设备与打开服务

1. iPhone 上「服务」→「添加设备」。
2. 列表会读取当前 Tailnet，按在线优先列出设备；点选即可。也可以手动输入私人名称（例如 `studio.example.ts.net`）作为兜底。已添加的设备会标记为「已添加」。
3. 列表会显示这台 Mac 当前共享的 HTTP 服务；TCP 服务标记为「iOS 不支持」，不提供打开入口。
4. 点服务进入舞台。列表、设备与设置都是覆盖式 Sheet，返回不会卸载舞台或重新加载页面。

## 进入后台与恢复

iOS 只允许前台访问。进入后台时 Rust 宿主调用 `vela_core_suspend`，关闭所有 loopback 监听但保留 tsnet 状态与当前服务；回到前台调用 `vela_core_resume`，用记住的端口重建映射。若页面在挂起期间失败，Vela 会在网络恢复后重新加载。

这是设计约束，不是缺陷：锁屏或后台期间无法访问远端服务。

## Web Inspector 调试

Debug 构建把 `isInspectable` 设为 `true`。检查内嵌页面：

1. iPhone 用数据线连接 Mac，并在手机上信任这台 Mac。
2. iPhone 设置 → Safari → 开发者 → 打开「Web Inspector」。
3. Mac Safari → 设置 → 高级 → 勾选「显示网页开发者功能」。
4. Mac Safari → 开发 → 选择 iPhone → Vela → 选中当前服务页面。
5. 在控制台查看 SSE / WebSocket 错误、Cookie 与页面日志。

Release 构建不暴露 Inspector。若「开发」菜单里看不到 Vela，确认 App 是 Debug 构建、手机已解锁且 Safari 的开发者模式已开启。

## 数据与隔离

| 内容 | 位置 |
|---|---|
| tsnet 身份 | `Library/Application Support/vela/network` |
| 配置（设备、端口记忆） | `Library/Application Support/vela/config.json` |
| WebView 数据 | 每个「设备 + 服务」一个 `WKWebsiteDataStore`，由 `dataKey` 的 UUID 标识 |
| 诊断 | 内存中的脱敏 journal；复制时只含版本、状态与错误 |
| Gravatar | 默认关闭；开启后仅发送规范化邮箱的 SHA-256 哈希，图片失败时显示首字母 |

两台 Mac 共享同名 OpenCode 时，各自的 Cookie、localStorage 与登录态互不覆盖；重启 App 后仍有效。切换服务只替换 `source`，不会清空数据存储。

“设置 → 隐私 → 使用 Gravatar 头像”是显式开关，默认关闭。开启后 Core 在本地将账户邮箱去除首尾空白、转小写并计算 SHA-256，只把哈希放进 `https://gravatar.com/avatar/<hash>?s=128&d=404` 请求；非邮箱身份、不存在头像、断网或请求失败时继续显示本地首字母头像。

## 浏览器布局规范

服务浏览器必须使用 UIKit 真实约束划定 WebView，不得通过 WebKit 内部 inset 或页面脚本模拟安全区：

| 项目 | 规范 |
|---|---|
| 顶部边界 | 容器顶部 + 63pt |
| 常态底部边界 | 容器底部 - 84pt |
| 比例 | 顶部 : 底部 = 3 : 4 |
| 底部组成 | 52pt 工具栏 + 20pt 浮起距离 + 12pt 上方背景留白 |
| 键盘 | WebView 底边不得低于 `UIKeyboardLayoutGuide.topAnchor` |
| 工具栏收起 | 仅改变工具栏外观，不改变 WebView 边界或 viewport |
| 顶部/底部背景 | `WKWebView.themeColor`；回退 `underPageBackgroundColor`、系统画布色 |

实现约束：常态底边约束使用优先级 999，键盘顶边约束为必需约束。禁止监听键盘通知后手动修改 frame，禁止写入 `obscuredContentInsets`、`contentInset` 或 `contentOffset`，也禁止用 `visualViewport`、DOM transform/translate 补偿。iOS 26 下这些做法会导致布局视口与视觉视口不同步，出现页面整体上移、状态栏遮挡或底部空白。浏览器外沿颜色必须读取 WebKit 的 `themeColor` 语义属性；不得截图取色、遍历 DOM 背景或让页面跨桥传入 CSS 色值。

任何浏览器布局修改都必须在 iPhone 真机回归以下场景：

1. OpenCode 普通上下滚动时，整个页面不发生位移；
2. 打开键盘后输入框完整可见；
3. 关闭键盘后页面恢复原位，顶部与底部无残留空白；
4. 顶部边界保持 63pt；
5. 工具栏上方保留 12pt 背景留白，呈现上下 padding 的浮动效果；
6. localhost:3000 等普通页面同样不被状态栏、工具栏或键盘遮挡。
7. OpenCode 切换明暗主题后，顶部 63pt、底部 84pt 与状态栏文字同步变化。

## 常见故障

| 现象 | 处理 |
|---|---|
| 一直显示「需要连接」 | 设置 → 连接私人网络；确认登录完成后点检查 |
| 设备在线但没有服务 | Mac 上 Vela 未共享服务，或清单版本不兼容；升级两端 Vela 后刷新 |
| 打开服务显示「远端设备离线」 | 确认 Mac 未休眠、Vela 在运行、两台设备在同一 tailnet；Vela 会自动重试一次，也可手动重试 |
| 页面白屏 / 加载失败 | 点舞台上的「重新加载」；Debug 构建用 Safari Inspector 看控制台 |
| 页面滑动或关闭键盘后整体上移 | 检查 WebView 是否仍使用 63/84pt 真实约束；不得恢复 WebKit inset、scroll offset 或 DOM 位移补偿 |
| 重装后要重新登录 | 是否删除过 App；删除会清空容器。覆盖安装不会 |
| App 启动即闪退 | 描述文件过期（7 天）。重新构建并覆盖安装，不要删除 App |
| 模拟器无法访问 Mac 服务 | 模拟器的 tsnet 需要单独认证；确认模拟器内已完成登录 |

诊断复制不包含 Cookie、token、页面内容或文件内容；如果问题需要这些信息，请自行在 Inspector 中查看，不要粘贴到公开渠道。

## 验收记录

在真机上完成以下清单（任务 7.3）：

- [x] Mac mini 与 Studio 都共享 OpenCode，两台分别登录，互不覆盖（独立 `WKWebsiteDataStore` 真机验证）
- [x] 杀掉 Vela 再打开，两台登录态仍在（覆盖安装及重启后存储继续使用）
- [x] 打开服务 → 切到后台 → 回到前台，服务恢复且不丢当前选择（2026-10-24，修复映射生命周期后真机验证）
- [x] OpenCode 完成配对、Cookie 持久、SSE 与 PTY WebSocket 正常、软键盘不遮挡输入（2026-10-24，iPhone 17 Pro 真机）
- [x] DSH 以 `127.0.0.1` authority 加载、共享端发布的登录链接认证通过、Cookie 保留（2026-10-24，iPhone 17 Pro 真机）
- [x] 断网显示离线提示，恢复后重试成功（2026-10-24，iPhone 17 Pro 真机）
- [x] 远端停止共享 localhost:3000 后，入口移除且进行中的访问显示服务不可用（2026-10-24，iPhone 17 Pro 真机）
- [x] 覆盖安装两次后 App 可启动，节点 ID 不变
- [ ] 签名到期后按上文重装步骤恢复
