# Vela NSH 对齐验收记录（2026-10-27）

本记录对应 OpenSpec change `align-vela-with-nsh-guides`，只记录当前工作树可复核的事实，不包含认证 URL、token、Cookie、凭据或服务页面内容。

## 自动化结果

- `pnpm -F vela verify` 通过：覆盖共享状态/流程、capabilities、Go race、macOS 与 iOS 结构/主题/typecheck、Rust fmt/test/clippy、目标平台语义和发布契约。
- `openspec validate align-vela-with-nsh-guides --strict` 通过。
- macOS target semantics：4/4 通过；覆盖 Button/Tab/Radio/ListRow 角色与受控状态、Menu 选择关闭、`computed` 缓存、timer cleanup、light/dark、减少动态效果和横竖 viewport。
- iOS simulator semantics：2/2 通过；覆盖 base Menu 的选择/取消关闭、disabled、light/dark 与减少动态效果。headless overlay test 单独覆盖平台 back 关闭。
- Rust host：外部 URL、iOS loopback WebView 与 OAuth/SSO 外部认证策略单测通过；macOS 原生按钮和开关行为测试通过。
- Host theme override：Vela 集成测试加载实际 macOS `Button` 与 iOS `Symbol`/`Toggle` wrapper，通过 NSH `EngineControl::set_tokens` 将 accent 覆盖为 `#12AB34`；同一运行时更新中观察到 TSX `bg-accent`、macOS `NSButton.accent`、iOS SF Symbol `tint` 与 `UISwitch.tint` 全部更新为规范化的 `#12ab34ff`。
- Gravatar：Core 通过宿主代理下载头像并在 status 中返回 data URL；该值写入 store 的只读 signal 并由 NSH `Image` 加载，关闭偏好、注销或头像缺失时回退到首字母。TSX 不需要直接网络能力。
- Tailscale 代理：macOS 设置可控制 helper 是否启用 Tailscale `useproxy`，默认开启并在旧配置迁移时保持开启；关闭后重启 Vela 生效，且不会禁用头像使用的宿主 HTTP 代理。

## macOS 产品视觉结果

- `macos-settings.png`：设置页“外观”分段控件直接位于页面背景，不再嵌套白色 Card。
- `macos-add-device-sheet.png`：FormSheet header 使用 10pt 垂直内边距，footer 使用 40pt 最小高度与 8pt 垂直内边距；内容区继续占用剩余空间。
- 截图位置：`.tmp/release/macos-settings.png`、`.tmp/release/macos-add-device-sheet.png`。它们是临时验证输出，不进入版本控制。

## 人工/真实宿主确认

- 2026-10-27，用户在正式 macOS/iPhone 构建上确认前述人工清单均表现正常：设置分组与连续 Switch 切换、Gravatar、Tailscale 代理开关重启行为、iOS 外观宽度与菜单关闭/焦点返回、真实服务/OAuth、VoiceOver、增大文字、浅色/深色、减少动态效果及 macOS 键盘交互。
- 该确认是用户报告，不描述为自动化、模拟器截图或代理观察结果。

## 2026-10-27 安装记录

- macOS：当前工作树构建为 arm64 ad-hoc `Vela.app`，安装到 `/Applications/Vela.app` 并启动；从已安装 bundle 回读版本 `0.2.0 (2)`，bundle id `io.implements.vela.macos`。
- iOS：当前工作树 device Release 构建使用现有有效 profile 离线签名；profile 对应 Team `57SAHVU4XB`、bundle id `io.implements.vela.ios`，包含目标 iPhone 17 Pro，2027-10-24 到期。证书 SHA-1 指纹与 profile 内证书一致。
- iPhone 17 Pro：通过 `devicectl` 覆盖安装（未卸载，保留 App container）并启动；设备 App 列表回读 Vela `0.2.0 (2)` 已安装。
