# Vela macOS 自动更新验收（2026-10）

## 证据边界

- 目标平台：Apple Silicon Mac，正式 Vela AppKit host。
- 更新起点：仅用于验收的 updater-capable `0.2.9 (2)` 完整应用；它由同一工作树产物复制，只修改版本和 loopback feed 配置后重新 ad-hoc 签名。
- 更新目标：发布门构建的 `0.3.0 (3)` 完整 ZIP，包含 Rust host、Go Core、NSH runtime、TSX UI、资源和 Sparkle framework。
- feed：本机 loopback fixture。此次环境没有可用的本地 HTTPS CA，因此使用仅在验收 build 中允许的 loopback HTTP；生产应用和发布 workflow 仍只使用固定 HTTPS URL。
- 签名：更新 ZIP 使用 Vela 生产 Sparkle EdDSA key 签名；私钥没有写入仓库、日志或构建产物。

## 已观察结果

| 行为           | 预期                                     | 实际                                                                                                                                                                                                      |
| -------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 手动检查       | 系统菜单触发原生更新 UI                  | 通过；显示 Sparkle“软件更新”窗口                                                                                                                                                                          |
| 更新说明与动作 | 显示版本说明、稍后、安装和跳过动作       | 通过；辅助功能树可读“稍后提醒我”“安装更新”“跳过这个版本”                                                                                                                                                  |
| 稍后处理       | 当前 build 和 Core 继续运行              | 通过；仍为 `0.2.9 (2)`，Vela 与 `vela-core` PID 保持不变                                                                                                                                                  |
| 下载           | 取得完整 ZIP                             | 通过；loopback server 记录约 29 MB ZIP 请求完成                                                                                                                                                           |
| 更新签名       | 解压前验证 EdDSA                         | 通过；Sparkle 日志记录签名正确                                                                                                                                                                            |
| 解压与 bundle  | 产生合法完整 `0.3.0` 应用                | 通过；缓存中的解压应用为 `0.3.0` 且 `codesign --verify --deep --strict` 通过                                                                                                                              |
| 正式退出清理   | 旧 Vela 与 Core 在替换前结束             | 通过；退出后旧 Vela/Core PID 均消失                                                                                                                                                                       |
| 完整替换       | 实际安装应用变为 `0.3.0 (3)`             | 通过；从安装 bundle 回读版本与 build 成功                                                                                                                                                                 |
| 自动 relaunch  | 第二阶段安装完成后启动新 build           | 通过；选择“安装并重启应用”后，新 `0.3.0 (3)` Vela 与 Core 使用新 PID 自动启动                                                                                                                             |
| 退出时安装     | 准备完成后正式退出会替换但不强制重启     | 通过；第一轮按 install-on-quit 替换为 `0.3.0 (3)`，旧 Vela/Core 均结束                                                                                                                                    |
| 无更新         | 当前 build 等于 feed build 时明确反馈    | 通过；原生 UI 显示“您使用的就是最新版”                                                                                                                                                                    |
| 网络失败       | 保留当前应用并提供错误信息               | 通过；无监听 HTTPS 端口显示“获取升级信息时出现错误”，`0.2.9` 与 Core 继续运行                                                                                                                             |
| 签名篡改       | 拒绝安装签名后被修改的 ZIP               | 通过；原生 UI 显示“此更新未正确签名，无法验证其真实性”，当前应用未替换                                                                                                                                    |
| 只读位置       | 说明不可更新并给出下一步                 | 通过；只读镜像中的应用提示移动到“应用程序”文件夹后重试                                                                                                                                                    |
| 用户数据       | 配置和私人网络身份跨更新保留             | 通过；Application Support 文件集合保持 11 个，`tailscaled.state` 摘要保持不变；运行配置、netmap cache 和日志按正常连接行为变化                                                                            |
| 活动资源清理   | 有共享和映射时有界退出并释放 helper/端口 | 通过；本机共享总开关和 OpenCode 共享开启，远端映射显示 1 个活跃连接；更新后旧 Vela PID 消失、映射端口不再监听，日志顺序为 `should-relaunch=true`、`will-install`、`will-relaunch`、`terminated core=None` |

## 根因与剩余验收

Sparkle 2.10.1 源码和目标机行为显示，最初的“安装更新”会完成下载与准备；准备完成后 Vela 显示“安装并重启应用”，该第二阶段动作以 `relaunch=true` 请求宿主终止并在替换后重启。第一轮在第二阶段前直接发送正常 Quit，验证了退出时安装；第二轮选择完整动作，验证了自动 relaunch。

HTTPS 验收使用临时受信任的 `localhost` 证书完成。活动共享与远端映射状态下的第二次更新确认了三秒有界退出、Core helper 结束、映射端口释放、完整替换和自动 relaunch。临时 loopback 证书、导出私钥、只读镜像和服务进程在验收结束后移除。

本记录不是 GitHub Release、iOS 真机或 Apple Developer ID/公证证据。
