# Spec Delta

## Purpose

让 iPhone 上的 Vela 以只读访问方的身份加入同一私人网络，发现并浏览 Mac mini / Studio 共享的 HTTP 服务，同时保持多设备同名服务之间互相隔离的登录态。

## ADDED Requirements

### Requirement: iOS 设备加入同一私人网络
Vela iOS MUST（必须）以交互式认证加入用户已有的私人网络，并将设备身份持久化在应用数据目录；应用包内 MUST NOT（禁止）包含可复用的长期认证密钥。认证 MUST（必须）在应用内完成，不得要求用户安装系统 VPN、网络扩展或全局代理。

#### Scenario: 首次认证
- **GIVEN** 当前 iPhone 尚无有效的 Vela 私人网络身份
- **WHEN** 用户选择连接
- **THEN** Vela 必须展示交互式认证流程，并在成功后显示该设备的身份

#### Scenario: 重启后恢复身份
- **GIVEN** 当前 iPhone 已完成认证且身份仍然有效
- **WHEN** 用户重新启动 Vela
- **THEN** Vela 必须恢复已有身份而无需再次登录

#### Scenario: 身份被撤销
- **GIVEN** 当前 iPhone 的身份已过期或被撤销
- **WHEN** Vela 尝试访问远端服务
- **THEN** Vela 必须停止访问并明确提示重新认证

#### Scenario: 不修改系统网络
- **GIVEN** iPhone 上已启用其他 VPN 或代理
- **WHEN** 用户启动 Vela 并访问远端服务
- **THEN** Vela 必须只使用应用内连接，且不改变现有系统网络配置

### Requirement: 只读服务发现
Vela iOS MUST（必须）从远端 Vela 读取版本化的服务清单，只展示当前共享且协议可识别的服务，并 MUST NOT（禁止）向远端发布本机服务、端口或能力。清单版本不兼容时 MUST（必须）阻止访问并提示升级。

#### Scenario: 获取兼容清单
- **GIVEN** 远端 Vela 使用客户端支持的清单版本
- **WHEN** 客户端刷新设备
- **THEN** 客户端必须显示设备名称及其当前共享的可访问服务

#### Scenario: 清单版本不兼容
- **GIVEN** 远端 Vela 的清单版本不受当前客户端支持
- **WHEN** 客户端读取清单
- **THEN** 客户端必须不建立任何映射，并提示升级 Vela

#### Scenario: 远端未开启共享
- **GIVEN** 远端 Vela 存在但未共享任何服务
- **WHEN** 客户端刷新该设备
- **THEN** 客户端必须显示设备在线但不提供可访问服务，且不得尝试建立连接

### Requirement: 仅应用内浏览
Vela iOS MUST（必须）在应用内 WebView 中打开 HTTP 服务，MUST NOT（禁止）把访问转交给系统浏览器。TCP 服务 MUST NOT（禁止）在 iOS 上提供访问入口，并必须说明该协议在 iOS 不可用。

#### Scenario: 打开 HTTP 服务
- **GIVEN** 远端共享的 OpenCode 或 DSH 在线且本机已获授权
- **WHEN** 用户选择该服务
- **THEN** Vela 必须在应用内加载该服务，且不离开当前应用

#### Scenario: 服务依赖 WebSocket
- **GIVEN** 服务页面已在内置 WebView 中加载
- **WHEN** 页面建立 SSE 或 WebSocket 连接
- **THEN** Vela 必须保持连接并完整传输数据

#### Scenario: 遇到 TCP 服务
- **GIVEN** 远端清单中存在 TCP 协议的服务
- **WHEN** 用户查看该服务
- **THEN** Vela 必须标记为 iOS 不支持且不提供打开或复制连接命令的入口

### Requirement: 按设备与服务隔离的会话
Vela iOS MUST（必须）按“设备 + 服务”隔离 Cookie 与本地存储，使不同设备上的同名服务互不覆盖登录态；隔离 MUST（必须）在应用重启后保持。Vela MUST NOT（禁止）通过清除 Cookie 或要求重新登录来规避隔离。

#### Scenario: 两台设备的同名服务
- **GIVEN** Mac mini 与 Studio 都共享了 OpenCode
- **WHEN** 用户分别在两者中完成登录
- **THEN** 两个登录态必须同时有效且互不覆盖

#### Scenario: 同一设备的多个服务
- **GIVEN** 同一设备共享了 OpenCode 与 DSH
- **WHEN** 两个服务设置同名 Cookie
- **THEN** 两个服务必须分别保持各自的登录状态

#### Scenario: 重启后保持登录
- **GIVEN** 用户已完成某个服务的登录
- **WHEN** 用户退出并重新启动 Vela，再次打开该服务
- **THEN** 登录态必须仍然有效

### Requirement: 前台会话生命周期
Vela iOS MUST（必须）把远端访问限制在前台会话内：进入后台时释放本地监听并保留设备与服务上下文，回到前台时重建连接并恢复当前服务。Vela MUST NOT（禁止）向用户承诺锁屏或后台期间仍可访问。

#### Scenario: 进入后台
- **GIVEN** 用户正在浏览某个远端服务
- **WHEN** 应用进入后台
- **THEN** Vela 必须停止接受新的本地连接，并保留当前服务上下文

#### Scenario: 返回前台
- **GIVEN** 应用曾在浏览某服务时进入后台
- **WHEN** 用户返回应用
- **THEN** Vela 必须重建连接并恢复该服务，必要时重新加载页面

### Requirement: 离线与恢复
当远端不可达、私人网络中断或设备休眠时，Vela iOS MUST（必须）保留当前设备与服务上下文，显示可区分的原因，并提供自动重试与手动重试，MUST NOT（禁止）静默关闭用户的当前服务。

#### Scenario: 远端离线
- **GIVEN** 用户正在浏览某个远端服务
- **WHEN** 远端 Mac 失去连接
- **THEN** Vela 必须显示离线状态与重试操作，且保留当前服务选择

#### Scenario: 恢复后继续
- **GIVEN** 当前服务因远端离线而不可用
- **WHEN** 远端重新可达且用户选择重试
- **THEN** Vela 必须重新建立映射并加载该服务

### Requirement: 服务清单变化跟随
Vela iOS MUST（必须）在远端清单变化后更新可访问服务，使用户无需重新添加设备即可看到新共享或已停止共享的服务。

#### Scenario: 远端新增服务
- **GIVEN** 一台已保存设备当时只共享了 OpenCode
- **WHEN** 远端随后共享 DSH 且客户端刷新或回到前台
- **THEN** DSH 必须出现在该设备下并可打开

#### Scenario: 远端停止共享
- **GIVEN** 用户曾可访问某个服务
- **WHEN** 远端停止共享该服务
- **THEN** 客户端必须在下一次刷新后移除该入口，并使进行中的访问显示不可用

### Requirement: 授权与访问边界
Vela iOS MUST（必须）只访问远端允许的已共享服务，MUST NOT（禁止）充当可拨任意地址的跳板，也 MUST NOT（禁止）绕过目标服务自身的认证。

#### Scenario: 访问未共享的服务
- **GIVEN** 远端存在某个未共享的本地服务
- **WHEN** 客户端尝试连接其端口
- **THEN** 远端必须拒绝连接，客户端必须显示不可用

#### Scenario: 保留目标服务认证
- **GIVEN** OpenCode 或 DSH 自身要求配对或 token
- **WHEN** 用户在内置 WebView 中访问
- **THEN** Vela 必须保留该认证流程，不得注入凭据或跳过校验

### Requirement: 诊断与隐私
Vela iOS MUST（必须）提供可用于排障的诊断信息（版本、连接状态、最近错误、当前映射），且 MUST NOT（禁止）在诊断中记录 Cookie、认证 token、页面内容或文件内容。

#### Scenario: 复制诊断
- **GIVEN** 用户遇到连接失败
- **WHEN** 用户选择复制诊断
- **THEN** 输出必须包含版本与脱敏后的错误，且不包含凭据或页面内容
