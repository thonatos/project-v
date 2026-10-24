> 归档记录：本文记录 2026-04 的验收事实，其中的目录与命令保留当时的写法，不再维护。

# Vela 双机验收记录

本记录只包含可复核的运行与验证事实，不含认证 URL、token、Cookie、凭据或页面内容。

## 验收范围

- 任务 `9.3`：两台真实 Mac 上同时共享与访问。
- 任务 `12.6`：外观、运行日志、连接活动与调试开关的收尾验证。

## 环境

| 项目           | 本机                          | 远端                     |
| -------------- | ----------------------------- | ------------------------ |
| 角色           | 访问端与共享端                | 访问端与共享端           |
| macOS          | 27.2                          | 27.0.1                   |
| 安装路径       | `.tmp/device-ip-app/Vela.app` | `/Applications/Vela.app` |
| `Vela` SHA-256 | `60484e84…682cb9`             | `60484e84…682cb9`        |
| 宿主进程       | 运行中                        | 运行中                   |
| Core 进程      | 运行中                        | 运行中                   |

两机可执行文件摘要一致，确认运行同一构建。

## 人工验收结论

由用户在两台 Mac 上实际使用后确认：

- 可从一台 Mac 正常访问另一台共享的服务。
- 服务页面可正常加载与交互。
- 重新打开已登录过的服务时不再要求重新输入密码。
- 设备列表显示 Tailscale IP。
- 外观切换立即生效且不重置设置页。
- 运行日志与连接活动可见。
- Tailscale 登录态、注销与后台移除设备后的重新登录流程可用。
- OpenCode 配对与登录态可用。
- DSH 认证与服务访问可用。
- SSH TCP 转发可用。
- ComfyUI 跨机访问、WebSocket 和工作流提交可用。

## 生命周期实测

在本机对运行中的构建执行：

- **Core 崩溃恢复**：`kill -9` 杀掉 Core 后，宿主进程保持不变（`76405`），Core 由监督器自动重启（`76408` → `76667`），应用无需重启。
- **窗口隐藏常驻**：`Cmd+W` 后 Vela 窗口不再可见（`CGWindowList` 查询为 `false`），宿主与 Core 进程仍存活，共享能力不中断。
- **Dock 激活恢复**：再次激活应用后窗口恢复为 `1280×752`，宿主进程仍为 `76405`，确认恢复的是同一实例而非重新启动。

## 自动化验证

发布前在本机执行并全部通过：

- `go vet ./...`
- `go test -race ./...`
- `cargo fmt --all --check`
- `cargo test --locked --workspace`
- `cargo clippy --locked --workspace --all-targets -- -D warnings`
- `sh scripts/nsh.sh check ui/App.tsx`
- `sh scripts/nsh.sh build ui/App.tsx --release`
- `node ui/tests/theme.test.mjs`
- `node ui/tests/view-model.test.mjs`
- `node ui/tests/desktop-layout.test.mjs`
- `codesign --verify --deep --strict`
- `openspec validate add-vela-macos-app --strict`

## 关键缺陷与修复

本轮验收期间定位并修复的问题：

- 控制协议白名单缺少 `preferences.update`、`diagnostics.logs`、`diagnostics.activity`，请求被 Rust 宿主拒绝；已在两侧注册并增加跨语言词汇表一致性测试。
- 连接活动按本机服务匹配，导致远端服务映射不可见；已改为以远端 manifest 发布的服务与真实映射为来源。
- 本地映射使用随机端口，Cookie 与 localStorage 因 origin 变化失效；已按「设备 + 服务」分配并持久化稳定端口，占用时回退并更新记录。
- 隐藏页面仍挂载原生控件造成跨页泄漏；已改为按当前模块条件渲染。

## 未覆盖项

以下仍需独立进行，不在本记录范围内：

- `3.2` 测试 tailnet 的首次登录、重启免登录与设备撤销。
- `4.6` 共享安全边界与 DSH authority 配置文档验证。
- `8.4`、`8.5` OpenCode 与 DSH 产品契约验证。
- `8.6` 浏览器中的键盘、手势、文件选择与下载体验验证。
- `9.5` 用户文档逐步验证。
- 直连与 DERP 路径、断网恢复的专项记录。
