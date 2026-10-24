# Vela 双机验收记录（2026-10）

本记录只包含可复核的运行与验证事实，不含认证 URL、token、Cookie、凭据或页面内容。

## 环境

| 项目           | 本机                                                               | mac mini                 |
| -------------- | ------------------------------------------------------------------ | ------------------------ |
| 角色           | 访问端与共享端                                                     | 访问端与共享端           |
| macOS          | 27.2（26B118）                                                     | 27.2（26B118）           |
| 架构           | arm64                                                              | arm64                    |
| 安装路径       | `packages/apps/vela/build/app/Vela.app`                            | `/Applications/Vela.app` |
| `Vela` SHA-256 | `3d502a57d521ec7f977670e6cb713b86ee3a27a06fa43f3d07324e528d9799ac` | 同左                     |
| `vela-core`    | 由 App 启动，运行中                                                | 由 App 启动，运行中      |

两台机器的可执行文件摘要一致，确认运行同一构建。

## 部署记录

- mac mini 部署方式：正常退出旧版 → 旧包移至 `/Applications/Vela.app.previous` → `rsync -aE` 拷贝本次构建 → `codesign --verify --deep --strict` 通过 → 启动。
- 本机启动前清理了一个遗留的旧构建实例（`.tmp/release-build/Vela.app`，摘要不同），避免两个 Core 共用同一份 tsnet 身份目录。
- iOS 模拟器中的旧实例已终止，模拟器已关闭。

## iOS 构建与安装

| 项目     | 结果                                                                                    |
| -------- | --------------------------------------------------------------------------------------- |
| 签名团队 | 组织团队（Xcode 已登录；团队 ID 不写入记录）                                            |
| 描述文件 | `iOS Team Provisioning Profile: io.implements.vela.ios`，2027-10-22 到期，已包含目标设备 |
| 签名校验 | `codesign --verify --deep --strict` 通过；`application-identifier` 与描述文件团队一致   |
| 目标设备 | iPhone 17 Pro（已配对真机）                                                             |
| 安装     | `xcrun devicectl device install app` 成功，设备上显示 Vela 0.1.0 (1)                    |
| 启动     | `devicectl device process launch` 成功                                                  |

构建命令：`DEVELOPMENT_TEAM=<team-id> sh scripts/build-ios.sh`。

## 已确认

- **macOS 双机验证正常**（用户确认，2026-10-24）。
- **iOS 端显示的信息与预期一致**（用户确认，2026-10-25）：设备与服务可从手机查看。
- 两端 Vela 进程与 `vela-core` 均正常启动，退出旧实例时 Core 随之退出。
- **退出清理**（本机实测，2026-10-25）：通过应用退出路径关闭 Vela 后，`Vela` 与 `vela-core` 均退出；重新启动后两者重新拉起。
- **iOS 离线提示与恢复**（用户确认，2026-10-25）：断网时显示提示，联网后恢复。
- **非法设备名被拒绝**（用户确认，2026-10-25）：带空格或超长的名称在两端 UI 上被拒绝。
- **`Cmd+W` 常驻**（用户确认，2026-10-25）：关闭窗口后应用与 Core 继续运行。

## 待补

无。本次范围内的验收项均已完成。

## 备注

- 验收通过后可删除 mini 上的 `/Applications/Vela.app.previous`。
- 新的验收记录按 `acceptance-<YYYY-MM>.md` 命名，只记录事实与结论，不记录页面内容。
- 验收时两端运行 `3d502a57…`。之后为本机产物去除构建路径并重建，本机哈希变为 `d7a231f1…`；功能与验收构建一致。

## 2026-10-25 复验：跨端界面一致性

本记录对应 change `fix-vela-verification-findings`。

### 构建与安装

| 项目                 | 结果                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| macOS 构建           | `sh scripts/build-app.sh .tmp/release-build`，`codesign --verify` 通过  |
| macOS 运行           | `build/app/Vela.app`（由验收构建原样拷贝，哈希一致）                    |
| macOS `Vela` SHA-256 | `f8ae90db44c08c97f0ca11f21a75ad1471c5bea6db50acb973e49fa60dbfb923`      |
| macOS `vela-core`    | `10863fc941d8c384062db86a69b17bf62470516a1e4b560777366724b295085f`      |
| 应用版本             | 0.1.0 (1)，两端一致                                                     |
| iOS 构建             | `DEVELOPMENT_TEAM=<team-id> sh scripts/build-ios.sh`，BUILD SUCCEEDED   |
| iOS 描述文件         | `iOS Team Provisioning Profile: io.implements.vela.ios`，2027-10-22 到期 |
| iOS 安装             | `xcrun devicectl device install app` 覆盖安装到 iPhone 17 Pro 成功      |
| iOS 启动             | `xcrun devicectl device process launch` 成功                            |
| iOS `Vela` SHA-256   | `50771bbbfe6c8e1193c3edb40b2b636510d68edb609463ba1ab8b8e1e409ef0b`      |

### 已确认（用户，2026-10-25）

- macOS 账户页：顶部为头像与账户名身份头，账户只出现一次；顺序为私人连接（状态与 Tailnet）→ 这台 Mac 的身份 → 登录/注销。
- macOS 设置：外观 → 共享 → 通用 → 隐私 → 诊断 → 关于；外观说明位于卡片外；关于显示版本 `0.1.0` 与控制协议 `v1`。
- macOS 日志：级别使用分段控件并带计数，提供复制日志，空态区分「暂无日志」与「该级别没有记录」。
- macOS 设备：行结构为图标 + 名称 +「状态 · N 个服务」+ 状态点，地址只在详情；词表为「其他设备 / 添加设备 / 还没有添加其他设备」。
- iOS 冷启动：首屏立即可见并显示「连接中」，连接后设备与服务自动出现，无需手动刷新。
- iOS 账户：身份头只出现一次；私人连接位于设备身份之前；开发签名按 2027 到期说明，不再写「7 天」。
- iOS 设备、设置、日志：词表与控件与 macOS 对齐。

### 自动化结果

- `pnpm -F vela verify` 通过。
- `pnpm check` 0 errors（124 条既有 NSH JSX 警告）。
- `pnpm test` 352 passed。
- `openspec validate fix-vela-verification-findings --strict` 通过。
- 验收未使用截图或视觉基线。

### 备注

- iOS 描述文件到期时间取自构建产物的 `embedded.mobileprovision`。
- 本次未 push 到远程。
