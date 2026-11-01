# Spec Delta

## MODIFIED Requirements

### Requirement: 插件单次注册与启动

系统 SHALL 与 dsh `0.2.1-rc.5` 的插件清单、Loader 配置和客户端模块协议兼容。已安装插件 SHALL 保留包内 bundle patch，使 dsh 自动注册插件；常规启动不得重复应用同一 patch，最终插件树 MUST 只包含一个 `id: dsh-telegram`。插件的非敏感设置 SHALL 由该 Loader entry 的 Config 提供，并可从 Plugin Manager 中该 package 的 `dsh-telegram` row 配置页编辑。经操作者明确批准，验收 MAY 将 web profile 绑定到一个具体的受信私有 LAN 地址；该启动 MUST 配置匹配的 trusted host authority、拒绝 wildcard 地址、禁止公网转发，并在不再需要局域网访问时停止进程。

#### Scenario: 已安装插件正常启动

- **GIVEN** dsh `0.2.1-rc.5` profile 已安装 `@implementsio/dsh-telegram`，且包清单声明 `dsh.bundle.patch`
- **WHEN** 用户运行 `dsh web` 或 `dsh --profile web`
- **THEN** 系统 SHALL 通过包内 patch 自动注册并加载一次 `dsh-telegram`

#### Scenario: 防止重复注册

- **GIVEN** `@implementsio/dsh-telegram` 已安装到目标 dsh profile
- **WHEN** 生成或验证最终插件树
- **THEN** 文档和验收流程 SHALL 要求不再额外传入同一 `cordis.patch.yml`，并 SHALL 在启动前统计最终配置中的 `id: dsh-telegram`；数量不等于一时 MUST 主动终止验收，不得依赖 dsh 自身拒绝重复 row

#### Scenario: 未安装插件的隔离开发

- **GIVEN** `@implementsio/dsh-telegram` 尚未安装到目标 dsh profile
- **WHEN** 开发者需要临时加载本地插件
- **THEN** 系统 MAY 允许显式应用本地 `cordis.patch.yml`，但该模式 MUST 与 profile 安装模式互斥

#### Scenario: 使用本地 link 安装验收包

- **GIVEN** 当前仓库中的 `@implementsio/dsh-telegram` 已完成测试与客户端构建，web profile 尚未运行验收进程
- **WHEN** 操作者通过 dsh 的 web profile 包管理入口将该本地包绝对路径执行 `pnpm link`
- **THEN** web profile SHALL 将 `@implementsio/dsh-telegram` 解析到当前工作区目录，并通过包内 `dsh.bundle.patch` 自动注册插件，不得额外传入同一 patch

#### Scenario: 验收阶段禁止发布安装

- **GIVEN** 插件尚处于本 change 的验收阶段
- **WHEN** 准备将插件安装到 web profile
- **THEN** 流程 MUST NOT 执行 `npm publish`、`pnpm publish` 或从 registry 安装待发布插件版本，且 SHALL 只使用已构建的本地 link 包作为被测插件

#### Scenario: 清理本地验收链接

- **GIVEN** web profile 已通过本地 link 完成验收，且 link 前依赖状态已记录
- **WHEN** 验收结束或回滚
- **THEN** 操作者 SHALL 停止 dsh Web、撤销本次 `@implementsio/dsh-telegram` link，并验证没有覆盖 web profile 中与本次验收无关的配置或依赖

#### Scenario: 从 Plugin Manager 打开设置

- **GIVEN** dsh `0.2.1-rc.5` Web 已加载插件及其客户端模块
- **WHEN** 用户在 Plugin Manager 中打开 `@implementsio/dsh-telegram` 的 `dsh-telegram` row 配置
- **THEN** 系统 SHALL 展示该 Loader entry 的当前非敏感配置、Workspace 选项和 Bot Token 脱敏状态，并允许在 Host 可写时保存

#### Scenario: 拒绝不兼容的宿主组合

- **GIVEN** 插件运行所需的 dsh `0.2.1-rc.5` Loader、Settings 或 Agent 能力不存在
- **WHEN** Host 尝试加载或启用插件
- **THEN** 系统 SHALL 明确报告宿主不兼容或缺失服务，不得启动部分初始化的 Telegram 客户端

#### Scenario: 通过 web profile 提供局域网访问

- **GIVEN** 验收主机已连接受信私有局域网，且已探测到当前非 loopback IPv4 地址
- **WHEN** 操作者明确批准局域网访问，并通过 `--host <lan-ip>` 将 `dsh web` 绑定到当前主机的具体私有 LAN 地址，同时传入监听端口和匹配的 LAN trusted host authority
- **THEN** 同一受信局域网中的浏览器 SHALL 能通过该地址和启动时生成的 token URL 访问 dsh Web 和 Telegram row 配置页，且 profile 永久配置和仓库文件 MUST NOT 被修改

#### Scenario: 拒绝不安全的网络暴露

- **GIVEN** 操作者准备执行局域网验收
- **WHEN** 尚未获得明确授权，或计划使用公网地址、wildcard 地址、端口转发、不匹配的 trusted host authority
- **THEN** 验收流程 SHALL 拒绝继续；已获授权的具体 LAN 地址监听也 MUST 在不再需要局域网访问时停止

### Requirement: 私聊会话路由

系统 SHALL 将单个 Telegram Bot 默认绑定到一个已验证的 Workspace，并按 Telegram 私聊用户 ID 持久化 Harness Session ID、当前 Workspace ID 和可选模型选择。绑定 SHALL 通过 dsh storage 子系统持久化。新 Session MUST 将实际挂载的 Agent preset 记为 durable Session metadata；恢复 Session MUST 使用其 projection 中的当前 preset，不得因 Host 默认 preset 改变而漂移。所有创建或恢复的 Session MUST 属于当前绑定的 Workspace，任何绑定写入 MUST 保留非本路径负责的字段。

#### Scenario: 首条普通消息

- **GIVEN** 已授权私聊用户不存在持久化绑定，且 Host 存在可用默认 Agent preset
- **WHEN** 用户发送普通文本
- **THEN** 系统 SHALL 在 Bot 默认 Workspace 下创建 Harness Session、把实际 preset 写入 Session metadata、保存含 Workspace ID 的绑定并将文本提交到该 Session

#### Scenario: 已有绑定

- **GIVEN** 已授权私聊用户已有含 Session ID 和 Workspace ID 的绑定
- **WHEN** 用户发送普通文本
- **THEN** 系统 SHALL 验证 Workspace 仍已登记且 Session cwd 属于该 Workspace后恢复它，不得创建第二个 Session

#### Scenario: 新建会话

- **GIVEN** 私聊已绑定一个有效 Workspace
- **WHEN** 用户发送 `/new`
- **THEN** 系统 SHALL 在当前绑定的 Workspace 下创建新的 Harness Session、记录实际 Agent preset、替换当前私聊绑定并沿用已持久化的模型选择

#### Scenario: Workspace 配置变更

- **GIVEN** Bot 配置的默认 Workspace 被修改
- **WHEN** Runtime 重新启动且私聊没有其他有效 Workspace 绑定
- **THEN** 系统 SHALL 只允许在新默认 Workspace 下创建或恢复 Session

#### Scenario: Workspace 不可用

- **GIVEN** Bot 配置的默认 Workspace 不存在、未登记或不在 Harness 允许范围内
- **WHEN** 插件尝试启动 Telegram Runtime
- **THEN** 系统 SHALL 拒绝启动，并通过插件设置状态报告可操作的 Workspace 配置错误

#### Scenario: 绑定持久化落地

- **GIVEN** 系统需要创建、替换、切换或删除某私聊用户的 Session 绑定
- **WHEN** 绑定发生变更
- **THEN** 系统 SHALL 通过 storage 子系统持久化该变更，使 Runtime 重启后能恢复 Session、当前 Workspace 和完整模型选择，且不得在项目工作目录留下状态文件

#### Scenario: 绑定 Workspace 失效

- **GIVEN** 持久化绑定引用的 Workspace 已被删除或目录不可用
- **WHEN** 用户再次发送普通消息
- **THEN** 系统 SHALL 使该绑定失效并回退到已验证的默认 Workspace 创建新 Session，不得恢复到错误目录

#### Scenario: 切换 Workspace 保留模型选择

- **GIVEN** 私聊绑定已持久化一个完整模型选择
- **WHEN** 用户切换 Workspace，导致系统创建新 Session 并替换绑定
- **THEN** 系统 SHALL 在新绑定中保留原有模型选择，并使新 Session 使用该选择

#### Scenario: Session resume 失败重建保留模型选择

- **GIVEN** 私聊绑定已持久化一个完整模型选择，但其 Session 无法 resume
- **WHEN** 系统删除失效绑定并在当前 Workspace 重建 Session
- **THEN** 系统 SHALL 使重建后的绑定保留原有模型选择，不得回落到全局默认模型

#### Scenario: 恢复 Session 使用历史 preset

- **GIVEN** 已持久化 Session 的 Agent preset 与 Host 当前默认 preset 不同
- **WHEN** Runtime 恢复该 Session
- **THEN** 系统 SHALL 挂载 Session projection 记录的 preset，使恢复前后的工具、提示和能力组合保持一致

#### Scenario: 兼容缺少 preset 记录的旧 Session

- **GIVEN** Session 由旧版插件创建且没有 Agent preset metadata 或 projection
- **WHEN** dsh `0.2.1-rc.5` Runtime 尝试恢复它
- **THEN** 系统 SHALL 使用当前可用的默认 preset 恢复，或在无法安全恢复时使旧绑定失效并新建 Session，不得挂载未验证的 preset

### Requirement: 凭据保护

系统 SHALL 将 Bot Token 存储在 Harness credentials 中，其他非敏感配置存储在 dsh `0.2.1-rc.5` Loader Settings 中，日志和状态接口不得输出 Token 原文。Plugin Manager 中的 Telegram row 配置页 SHALL 使用当前 credentials RPC 读写脱敏凭据状态，并通过 Host 配置表单原子提交非敏感字段。保存启用状态前 MUST 确认 Token 已配置；失败反馈 SHALL 可操作且不得泄露凭据。

#### Scenario: 缺少登录材料

- **GIVEN** Telegram 插件尚未配置有效 Bot Token
- **WHEN** 用户启用插件或尝试保存启用状态
- **THEN** 系统 SHALL 拒绝启动并提供可操作的配置错误，不得启动半初始化客户端

#### Scenario: 读取凭据状态

- **GIVEN** dsh Host 已挂载 credentials provider
- **WHEN** Telegram row 配置页读取 `DSH_TELEGRAM_BOT_TOKEN` 状态
- **THEN** 系统 SHALL 通过当前 credentials RPC 的引用数组参数读取状态，并只向页面提供该引用的脱敏元信息，不得返回 Token 原文

#### Scenario: 原子保存普通配置

- **GIVEN** 用户修改多个非敏感 Telegram 配置字段，且 Host Settings 可写
- **WHEN** 用户保存设置
- **THEN** 页面 SHALL 以一次有 revision 防护的原子配置变更提交完整字段集合，不得通过逐字段写入暴露可运行的中间状态

#### Scenario: 保存 Bot Token

- **GIVEN** 用户输入非空 Bot Token 并请求启用 Telegram
- **WHEN** 用户保存设置
- **THEN** 系统 SHALL 先通过 credentials RPC 写入 Token，并在脱敏状态确认 `configured` 后才原子提交启用配置

#### Scenario: 配置冲突

- **GIVEN** 用户打开表单后 Host 配置 revision 已变化
- **WHEN** 页面以旧 revision 保存
- **THEN** 系统 SHALL 拒绝覆盖、刷新最新配置并提示用户重试，不得静默覆盖其他写入

#### Scenario: 凭据 RPC 失败

- **GIVEN** credentials RPC 返回失败结果或调用异常
- **WHEN** Telegram 设置页读取或写入 Bot Token
- **THEN** 系统 SHALL 显示能区分读取或写入阶段的错误反馈，并且错误文本、日志和 UI 状态不得包含 Token 原文

#### Scenario: 状态查询

- **GIVEN** Bot Token 已配置
- **WHEN** UI 或 `/status` 查询连接状态
- **THEN** 系统 SHALL 返回脱敏的连接信息，不得包含 Bot Token
