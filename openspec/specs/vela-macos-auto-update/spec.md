# vela-macos-auto-update Specification

## Purpose

为 macOS Vela 提供可信、低打扰且可恢复的完整应用更新能力，使 Rust host、Go Core 与 TSX UI 始终作为同一兼容单元升级，同时保留用户对安装时机的控制。

## Requirements

### Requirement: macOS 应用必须发现稳定更新
macOS Vela MUST 在用户允许自动检查后定期检查稳定更新，并 MUST 提供“检查更新…”手动入口；iOS MUST NOT 因此变更获得应用内更新入口。自动检查 MUST NOT 在首次启动时打断用户，且测试版、Draft 或 Prerelease MUST NOT 出现在稳定通道。

#### Scenario: 后台发现公开稳定版本
- **GIVEN** 用户已允许自动检查，且更新源存在高于当前 build 的公开稳定版本
- **WHEN** Vela 执行后台更新检查
- **THEN** 应用必须向用户提供该稳定版本及其版本说明，不得展示尚未公开的候选版本

#### Scenario: 用户手动检查但没有更新
- **GIVEN** 当前安装的 build 已是稳定通道最新版
- **WHEN** 用户选择“检查更新…”
- **THEN** 应用必须明确告知当前已是最新版本

#### Scenario: 首次启动保持低打扰
- **GIVEN** 用户首次启动新安装的 Vela
- **WHEN** 主窗口显示
- **THEN** 应用不得立即弹出自动检查授权或更新结果对话框

#### Scenario: iOS 保持原分发边界
- **GIVEN** 用户运行同营销版本的 Vela iOS 应用
- **WHEN** 用户查看菜单和设置
- **THEN** 应用不得提供绕过平台分发机制的应用内更新入口

### Requirement: 更新必须覆盖完整应用兼容单元
Vela MUST 以完整 `Vela.app` 为更新与回退单元，使 Rust host、Go Core、NSH runtime、TSX UI 和资源来自同一发布 build。系统 MUST NOT 将仅更新远程 NSH UI 包作为完整应用更新成功。

#### Scenario: 安装新版本
- **GIVEN** 一个更新已经下载并通过验证
- **WHEN** 用户确认安装
- **THEN** 系统必须替换完整应用，并在重启后运行同一 build 中的 host、Core、runtime 与 UI

#### Scenario: 只有 UI 包可用
- **GIVEN** 远端仅存在高于内置 UI 的 NSH 签名包
- **WHEN** Vela 检查完整应用更新
- **THEN** 系统不得将该 UI 包安装或报告为 Vela 应用更新

### Requirement: 更新内容必须在执行前通过独立签名验证
Vela MUST 仅安装由应用内置更新公钥验证通过、应用身份匹配且 build 高于当前安装的完整更新。TLS、SHA-256 或 GitHub Artifact Attestation MAY 提供附加来源证据，但 MUST NOT 代替客户端执行的更新签名验证。

#### Scenario: 合法更新通过验证
- **GIVEN** 下载归档的应用身份正确、build 更高且更新签名与内置公钥匹配
- **WHEN** Vela 验证该归档
- **THEN** 系统必须允许用户继续安装

#### Scenario: 归档被篡改
- **GIVEN** 下载归档内容与发布时签名的内容不同
- **WHEN** Vela 验证该归档
- **THEN** 系统必须拒绝安装、保留当前应用并向用户说明更新无法验证

#### Scenario: 更新不是更高 build
- **GIVEN** 更新源提供的版本 build 小于或等于当前安装 build
- **WHEN** Vela 比较更新版本
- **THEN** 系统不得将其作为可安装更新，以防止意外降级或重复安装

### Requirement: 用户必须控制下载与安装时机
Vela MUST 使用符合 macOS 习惯的原生更新界面展示版本、说明和动作。首期更新 MUST NOT 静默强制安装；用户 MUST 能推迟安装，并可选择在准备好时安装重启或在正式退出时安装。

#### Scenario: 用户推迟更新
- **GIVEN** Vela 已发现一个有效更新
- **WHEN** 用户选择稍后处理
- **THEN** 应用必须继续运行当前版本，且不得在后台强制结束应用或替换安装

#### Scenario: 用户选择安装并重启
- **GIVEN** 更新已经完成下载和验证
- **WHEN** 用户选择安装并重启
- **THEN** Vela 必须先执行正式退出清理，再安装更新并启动新版本

#### Scenario: 用户选择退出时安装
- **GIVEN** 一个已验证更新等待安装
- **WHEN** 用户之后正式退出 Vela
- **THEN** 系统必须在退出清理完成后安装更新，并按用户选择执行后续启动行为

### Requirement: 安装必须协调 Vela 正式退出
更新安装 MUST 使用与应用菜单退出、Dock 退出和 `Cmd+Q` 相同的正式退出语义。Vela MUST 在有界期限内停止新连接、共享入口、活动映射、私人连接和辅助进程，然后才允许更新器替换应用；窗口关闭或 `Cmd+W` MUST NOT 触发安装清理。

#### Scenario: 有活动共享和映射时更新
- **GIVEN** Vela 存在活动共享、远端映射和正在运行的 Core helper
- **WHEN** 用户确认安装更新
- **THEN** 应用必须先停止新连接并有界清理这些资源，且旧 helper 不得在应用替换后继续运行

#### Scenario: 清理超过期限
- **GIVEN** 某个连接或辅助进程未在更新退出时及时关闭
- **WHEN** 优雅清理超过预设期限
- **THEN** Vela 必须结束自身辅助进程并允许更新继续，不得无限期阻塞安装

#### Scenario: 关闭窗口时有待安装更新
- **GIVEN** 已验证更新正在等待退出时安装
- **WHEN** 用户点击红色关闭按钮或执行 `Cmd+W`
- **THEN** Vela 必须只隐藏窗口并保持当前服务运行，不得把该操作解释为正式退出

### Requirement: 更新失败必须保留可运行版本和诊断路径
检查、下载、验证或安装失败时，Vela MUST 保留当前可运行应用及其用户数据，并 MUST 提供可执行的重试或手动下载路径。更新诊断 MUST NOT 包含凭据、认证 URL、Cookie 或业务内容。

#### Scenario: 网络下载失败
- **GIVEN** 更新下载因网络中断而失败
- **WHEN** 更新器报告失败
- **THEN** Vela 必须继续运行当前版本，并允许用户稍后重试

#### Scenario: 应用所在位置不可更新
- **GIVEN** Vela 从只读位置或无法替换的位置运行
- **WHEN** 用户尝试安装更新
- **THEN** 应用必须说明无法更新的原因并提供将应用安装到可更新位置或手动下载的下一步

#### Scenario: 安装事务失败
- **GIVEN** 当前应用有效且更新替换未能完成
- **WHEN** 安装事务终止
- **THEN** 系统必须保留或恢复一个可启动的 Vela 版本，并不得删除应用支持目录中的配置和私人网络身份

### Requirement: 更新信任状态必须准确披露
应用和发布说明 MUST 区分更新归档签名、Apple 代码签名与 Apple 公证。当前产物为 ad-hoc 签名且未公证时，界面和文档 MUST NOT 暗示该应用已获得 Developer ID 信任或 Apple 公证。

#### Scenario: 显示当前更新安全信息
- **GIVEN** Vela 使用更新归档签名验证一个 ad-hoc、未公证的新版本
- **WHEN** 用户查看更新或安装说明
- **THEN** 说明必须准确描述更新签名的作用，并继续披露 Apple 签名和公证状态
