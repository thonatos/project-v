# Tasks

## 1. 版本与「关于」

- [x] 1.1 在 `shared/ui` 增加唯一的 `APP_VERSION`，并加测试读取两个 `nsh.json` 的 `version` 做一致性校验。验证：`node shared/ui/version.test.mjs` 通过；手工改动任一 `nsh.json` 后测试失败。
- [x] 1.2 macOS client 暴露 `protocolVersion()`，store 增加派生值；删除设置页写死的 `'2'`，诊断复制与摘要改用派生值。验证：macOS `nsh check` 通过；诊断文本中的协议号与 `CoreBridge.protocolVersion()` 一致。
- [x] 1.3 macOS 设置页增加「关于」区块（应用版本、控制协议），iOS 的版本行改用 `APP_VERSION`。验证：两端结构测试断言「关于」存在且包含两项；`verify` 通过。
- [x] 1.4 更新 `docs/` 中涉及的版本说明（如有）。验证：`scripts/verify-docs.sh` 通过。

## 2. 启动不阻塞

- [x] 2.1 为 `network.Embedded` 增加 `StartAsync()`、`Running()`、`Starting()`；`Start()` 与 `Close()` 语义不变。验证：`go test ./internal/network` 通过；新增测试覆盖「异步启动不阻塞调用者」。
- [x] 2.2 `internal/core` 的状态读取在节点未运行时返回 `connecting`：`authStatus`、自身/对端快照、`remoteAddresses` 都不得阻塞。验证：新增假节点测试断言未运行时返回 `connecting` 且调用在毫秒级返回；运行后仍返回完整状态。
- [x] 2.3 iOS store 的首屏状态与轮询改用新语义：启动后立即结束加载态，显示「连接中」；连接后自动刷新设备与清单。验证：iOS 结构测试不再出现「首屏等待启动」的断言；真机冷启动时首屏立即可见。
- [x] 2.4 回归 macOS 的现有行为：首次状态请求不再阻塞，随后报告 `connected`。验证：`go test ./cmd/vela-core` 的进程金测试通过；`verify` 全绿。

## 3. 开发签名文案

- [x] 3.1 新增 `ios/ui/core/signing.ts` 纯函数，按到期时间返回四种文案；配套单测。验证：`node ios/ui/tests/signing.test.mjs` 覆盖未嵌入、已过期、≤7 天、>7 天四个分支。
- [x] 3.2 `MePage` 使用该函数替换写死的「免费签名 7 天有效」，并保留到期日期行。验证：结构测试断言不再包含「7 天有效」固定文案；真机显示 2027 到期时只说明覆盖安装。

## 4. 账户页（A 方案）

- [x] 4.1 macOS 新增 `Avatar` atom（首字母 + 可选远程图片 + 加载失败回退），并加入 atoms 导出。验证：结构测试断言 `Avatar` 存在且被账户页使用；图片加载失败时显示首字母。
- [x] 4.2 macOS 账户页改为「身份头 → 私人连接（状态 + Tailnet）→ 这台 Mac 的身份 → 登录/注销」；删除重复的「账户」行。验证：结构测试断言区块顺序与「账户」只出现一次。
- [x] 4.3 iOS 账户页：身份头保留头像与账户名，移除状态 chip；「私人连接」只保留状态 + Tailnet；设备身份区块移到其后；术语改为「私人连接」。验证：结构测试断言顺序与文案；`ios nsh check` 通过。
- [x] 4.4 macOS Core 打开 `Avatar` 选项，Gravatar 开启时 `status` 返回 `avatarUrl`；默认关闭时键集合不变。验证：载荷金测试通过；新增测试覆盖开启后出现 `avatarUrl`。
- [x] 4.5 同步更新 `docs/user-guide.md` 中账户页的说明与截图外的文字描述（不使用截图）。验证：`verify-docs.sh` 通过。

## 5. 设置页

- [x] 5.1 macOS 新增 `Segmented` atom（等宽分段、单一选中、键盘可达），并加入导出。验证：结构测试断言导出与外观页使用；键盘 Tab 可聚焦，回车/空格切换。
- [x] 5.2 macOS 设置页按「外观 → 共享 → 通用 → 隐私 → 诊断 → 关于」重排；外观改用 `Segmented`（跟随系统/浅色/深色）；「详细日志」「性能 HUD」与「复制诊断」同属诊断；增加 Gravatar 开关。验证：结构测试断言区块顺序与控件；切换外观、Gravatar、HUD 均即时生效。
- [x] 5.3 iOS 设置页对齐同一信息架构：外观用同一组文案；详细日志与复制诊断同属诊断；关于使用 `APP_VERSION`；Gravatar 仍在隐私区块。验证：两端设置区块清单一致（平台特有区块除外）；`ios nsh check` 通过。
- [x] 5.4 更新 `macos/ui/LAYERS.md`、`ios/ui/LAYERS.md` 中的 atom/区块说明。验证：文档路径与代码一致；`verify` 通过。

## 6. 日志页

- [x] 6.1 macOS 日志页用 `Segmented` 替换 4 个独立按钮，标签带计数；增加「复制日志」动作；空态区分「暂无日志」与「该级别没有记录」。验证：结构测试断言使用 `Segmented` 与两个动作；选择「错误」后列表只剩错误。
- [x] 6.2 iOS 日志页对齐标签、动作与空态文案（保留触控行样式与下拉刷新）。验证：两端级别文案与空态字符串一致；`ios nsh check` 通过。

## 7. 设备页

- [x] 7.1 macOS 新增 `IconTile` 与 `Dot` atom 并导出。验证：结构测试断言存在与使用点；状态颜色取自连接状态 token。
- [x] 7.2 macOS 设备行改为 `IconTile + 名称 + 「状态 · N 个服务」+ Dot`，移除行内徽标与地址；详情页增加 MagicDNS 与地址展示。验证：结构测试断言列表行不含地址字段；离线设备可进入详情并看到地址。
- [x] 7.3 两端统一术语：「其他设备」「还没有添加其他设备」「添加设备」；iOS 的「Mac」区块同步改名。验证：结构测试断言三处文案；UI 中不再混用「其他 Mac」。

## 8. 集成验收

- [x] 8.1 运行 `pnpm -F vela verify:release`（两端组包 + 签名）。验证：命令返回 0，报告无失败段。
- [x] 8.2 iOS 签名构建并覆盖安装到真机，逐项检查：冷启动首屏、连接后自动出现设备、账户页身份/连接各一次、设置与日志控件一致、设备行结构与术语。验证：结果记录到 `docs/verification/`，不使用截图。
- [x] 8.3 全仓检查：`pnpm check`、`pnpm test`、`openspec validate fix-vela-verification-findings --strict`。验证：三条命令均返回 0。

## Workflow follow-up

- 评审通过后归档变更，确认 `vela-ui-consistency` 进入主规格。
- 归档后重新构建并覆盖安装两端应用，确保验收记录对应新构建。
