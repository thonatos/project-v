# telegram-private-chat Specification

## Purpose
定义 DeepSeek Harness 的 Telegram 私聊插件运行时行为：通过 `node-telegram-bot-api` 接入单个 Bot，以 Bot API long polling 接收和发送私聊消息，将单个 Bot 绑定到一个 Workspace 并按私聊用户持久化 Harness Session 路由与模型选择，限制 Owner 私聊访问，支持基础命令、模型切换、媒体、出站类型映射、Harness 交互路由、代理与生命周期管理以及凭据保护。
## Requirements
### Requirement: 插件单次注册与启动

系统 SHALL 与 dsh `0.2.0-rc.2` 的插件清单、Loader 配置和客户端模块协议兼容。已安装插件 SHALL 保留包内 bundle patch，使 dsh 自动注册插件；常规启动不得重复应用同一 patch，最终插件树 MUST 只包含一个 `id: dsh-telegram`。插件的非敏感设置 SHALL 由该 Loader entry 的 Config 提供，并可从 Plugin Manager 中该 package 的 `dsh-telegram` row 配置页编辑。经操作者明确批准，验收 MAY 通过临时 overlay 将 web profile 短时绑定到全部 IPv4 接口；该例外 MUST 配置受信 LAN authority、禁止公网转发，并在验收结束后停止进程和删除 overlay。

#### Scenario: 已安装插件正常启动

- **GIVEN** dsh `0.2.0-rc.2` profile 已安装 `@implementsio/dsh-telegram`，且包清单声明 `dsh.bundle.patch`
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

- **GIVEN** dsh `0.2.0-rc.2` Web 已加载插件及其客户端模块
- **WHEN** 用户在 Plugin Manager 中打开 `@implementsio/dsh-telegram` 的 `dsh-telegram` row 配置
- **THEN** 系统 SHALL 展示该 Loader entry 的当前非敏感配置、Workspace 选项和 Bot Token 脱敏状态，并允许在 Host 可写时保存

#### Scenario: 拒绝不兼容的宿主组合

- **GIVEN** 插件运行所需的 dsh `0.2.0-rc.2` Loader、Settings 或 Agent 能力不存在
- **WHEN** Host 尝试加载或启用插件
- **THEN** 系统 SHALL 明确报告宿主不兼容或缺失服务，不得启动部分初始化的 Telegram 客户端

#### Scenario: 通过 web profile 提供局域网访问

- **GIVEN** 验收主机已连接受信私有局域网，且已探测到当前非 loopback IPv4 地址
- **WHEN** 操作者明确批准高风险例外，并通过不落库的临时 overlay 将 `dsh web` 的 webserver 绑定到 `0.0.0.0`，同时传入监听端口和匹配的 LAN trusted host authority
- **THEN** 同一受信局域网中的浏览器 SHALL 能通过该地址访问 dsh Web 和 Telegram row 配置页，且 profile 永久配置和仓库文件 MUST NOT 被该 overlay 修改

#### Scenario: 拒绝不安全的网络暴露

- **GIVEN** 操作者准备执行局域网验收
- **WHEN** 尚未获得明确授权，或计划使用公网地址、端口转发、不匹配的 trusted host authority、持久化 all-interface 配置
- **THEN** 验收流程 SHALL 拒绝继续；已获授权的临时 all-interface 例外也 MUST 在验收结束后立即撤销

### Requirement: 单 Bot 私聊连接

系统 SHALL 使用 `node-telegram-bot-api` 创建 Bot API long polling 客户端，使用 Bot Token 验证身份，并且同一时间最多只能有一个活动客户端。

#### Scenario: Bot 首次登录

- **WHEN** 插件启用且 credentials 中存在有效 Bot Token
- **THEN** 系统 SHALL 通过 `getMe` 验证 Bot 身份并启动 long polling

#### Scenario: 仅处理私聊

- **WHEN** 客户端收到群组、频道或自身发送的消息更新
- **THEN** 系统 SHALL 忽略该更新且不得创建或修改 Harness Session

### Requirement: Owner 私聊访问控制

系统 SHALL 要求配置一个 Telegram `ownerUserId`，并且只接受该用户的私聊消息；其他用户、群组、频道和 Bot 自身消息 SHALL 被忽略。

#### Scenario: Owner 发送私聊

- **WHEN** `message.isPrivate` 为真且发送者 ID 等于配置的 `ownerUserId`
- **THEN** 系统 SHALL 继续执行命令、文本或媒体处理

#### Scenario: 非 Owner 发送消息

- **WHEN** 私聊消息的发送者 ID 不等于 `ownerUserId`
- **THEN** 系统 SHALL 忽略消息且不得创建 Session、发送 Harness 状态或泄露配置错误

#### Scenario: 缺少 Owner 配置

- **WHEN** 插件启用但 `ownerUserId` 缺失或不是有效 Telegram User ID
- **THEN** 系统 SHALL 拒绝启动 runtime，并通过内置 Settings 报告配置错误

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
- **WHEN** dsh `0.2.0-rc.2` Runtime 尝试恢复它
- **THEN** 系统 SHALL 使用当前可用的默认 preset 恢复，或在无法安全恢复时使旧绑定失效并新建 Session，不得挂载未验证的 preset

### Requirement: 基础媒体消息

系统 SHALL 支持 Telegram 图片入站及其 caption，并 SHALL 支持将 Harness 已登记的图片产物带 caption 发送到对应私聊；首版不承诺普通文件入站。

#### Scenario: 图片带 caption 入站

- **WHEN** 私聊用户发送一张图片并附带 caption
- **THEN** 系统 SHALL 下载图片、保留 caption 文本，并将二者作为同一条 Harness 输入提交

#### Scenario: 图片无 caption 入站

- **WHEN** 私聊用户发送一张图片且没有 caption
- **THEN** 系统 SHALL 将图片提交到绑定的 Harness Session，不得因为缺少文本而静默丢弃

#### Scenario: 带 caption 出站媒体

- **WHEN** Harness 当前 Turn 登记了可交付的图片产物以及文本 caption
- **THEN** 系统 SHALL 通过 Bot SDK 发送图片并将 caption 附加到 Telegram 消息

#### Scenario: 媒体不可交付

- **WHEN** 图片类型不受支持、下载失败或超过 Telegram 限制
- **THEN** 系统 SHALL 向用户返回明确的媒体交付错误

### Requirement: 基础命令

系统 SHALL 支持 `/new`、`/status`、`/stop`、`/help`、`/workspace` 和 `/model`，并在 Bot 启动时注册到三个标准 scope。命令菜单、帮助和错误提示 MUST 派生自同一有序定义；命令展示不得放宽 Owner 私聊限制。未知斜杠命令 MUST 被拒绝。除按行分片的模型清单外，控制命令结果 MUST 使用结构化 Telegram card。
#### Scenario: 注册命令菜单

- **GIVEN** Bot 身份和 webhook 状态已验证
- **WHEN** Telegram 客户端启动 long polling
- **THEN** 系统 SHALL 清空 default、direct message、group chat、group administrators 和旧版 Owner chat scope 中已有命令，再仅向 direct message、group chat 和 group administrators 三个标准 scope 分别注册六个支持命令及描述，且注册顺序为名称长度升序

#### Scenario: 查看状态

- **GIVEN** Owner 私聊已有或可创建有效绑定
- **WHEN** 用户发送 `/status`
- **THEN** 系统 SHALL 以结构化 Telegram card 回复连接状态、当前 Workspace、当前 Session、当前模型选择、最近一次 Harness 状态和可用控制操作，且不得泄露凭据

#### Scenario: 停止任务

- **GIVEN** 当前 Session 存在运行中的任务
- **WHEN** 用户发送 `/stop`
- **THEN** 系统 SHALL 请求 Harness 停止该任务并回复处理结果

#### Scenario: 帮助命令

- **GIVEN** Owner 已连接 Bot 私聊
- **WHEN** 用户发送 `/help`
- **THEN** 系统 SHALL 以结构化 Telegram card 返回六个支持命令的列表及私聊范围说明，顺序与命令菜单一致（名称长度升序，`/workspace` 在末尾）

#### Scenario: 不支持的命令提示

- **GIVEN** Owner 发送了一个未注册的斜杠命令
- **WHEN** 系统解析该输入
- **THEN** 系统 SHALL 以结构化 Telegram card 返回不可用提示，并列出全部六个支持命令，顺序与命令菜单一致

#### Scenario: 展示 Workspace 选择卡片

- **GIVEN** Registry 中存在一个或多个 Workspace
- **WHEN** 用户发送不带参数的 `/workspace`
- **THEN** 系统 SHALL 返回包含 Workspace 标题、ID、当前选择状态和 inline callback 按钮的选择卡片

#### Scenario: 通过按钮切换 Workspace

- **GIVEN** Owner 点击仍对应已登记且目录可用 Workspace 的选择按钮
- **WHEN** 系统收到 callback query
- **THEN** 系统 SHALL 在目标 Workspace 创建新 Session、持久化替换当前绑定并清除原选择卡片的按钮

#### Scenario: 拒绝无效 Workspace

- **GIVEN** Workspace ID 未登记或目录不可用
- **WHEN** 用户通过 callback 请求切换
- **THEN** 系统 SHALL 返回脱敏的不可用提示且保持原绑定不变

#### Scenario: 拒绝非 Owner callback

- **GIVEN** callback 发送者不是配置的 Owner
- **WHEN** 发送者尝试选择 Workspace
- **THEN** 系统 SHALL 忽略该 callback，不得创建 Session 或修改绑定

### Requirement: 出站消息交付

系统 SHALL 将 Harness 文本输出发送到对应 Telegram 私聊。若本 Turn 没有通过增量事件交付任何有效正文，但 Session 已包含最终 assistant 消息，系统 SHALL 使用该最终消息兜底；若已交付流式正文，则 MUST NOT 重复发送最终正文。

#### Scenario: 增量事件缺失时交付最终回复

- **GIVEN** Harness 已将最终 assistant 消息写入 Session，但本 Turn 没有向 Telegram 桥接任何有效文本增量
- **WHEN** Agent 进入 idle
- **THEN** 系统 SHALL 从 Session 最终 assistant 消息补发正文，并沿用相同的富文本、分片和降级规则

#### Scenario: 正常流式回复不重复

- **GIVEN** 本 Turn 已通过增量事件向 Telegram 交付有效正文
- **WHEN** Agent 进入 idle 且 Session 中存在相同的最终 assistant 消息
- **THEN** 系统 MUST NOT 再次发送该最终正文

### Requirement: Harness 交互路由

系统 SHALL 将当前 Telegram 聊天发起的 Harness 审批、用户问题和其他需要用户输入的 interaction 路由到 Telegram；不得只让 dsh Web 默认界面消费该 interaction。

#### Scenario: 审批请求路由到 Telegram

- **WHEN** Telegram 发起的 Turn 产生 Harness 审批请求
- **THEN** 系统 SHALL 在同一 Telegram 聊天展示审批内容，并提供批准和拒绝操作；原始审批 SHALL 绑定当前聊天、发起用户和 interaction ID

#### Scenario: 用户问题路由到 Telegram

- **WHEN** Telegram 发起的 Turn 产生 Harness 用户问题
- **THEN** 系统 SHALL 在同一 Telegram 聊天展示问题和选项；用户的按钮或文字回答 SHALL 回写原始 interaction，而不是作为新的普通 prompt

#### Scenario: interaction 归属校验

- **WHEN** 其他聊天、其他用户或过期回调尝试回答 interaction
- **THEN** 系统 SHALL 拒绝该回答，不得修改原始 Harness Turn，并返回脱敏的已失效或无权限提示

#### Scenario: interaction 结束

- **WHEN** interaction 被回答、拒绝、取消或 Turn 被停止
- **THEN** 系统 SHALL 更新或关闭 Telegram card，并清理该 interaction 的内存和持久化路由状态

### Requirement: 出站类型映射

系统 SHALL 根据 Harness 输出块或事件的类型选择 Telegram 原生交付方式，不得将所有非文字内容统一序列化为普通文本。

#### Scenario: 文本输出

- **WHEN** Harness 输出 `text` 内容或文本增量
- **THEN** 系统 SHALL 使用 Telegram 文本消息发送或编辑，按 `messageLimit` 安全分片，并将 Markdown 渲染为受限 HTML（渲染失败时降级为纯文本）

#### Scenario: 媒体输出

- **WHEN** Harness 输出已登记的图片、音频、视频或文件 artifact
- **THEN** 系统 SHALL 分别使用 Telegram 图片、音频、视频或文件消息发送，并保留文件名和可选 caption

#### Scenario: 工具执行状态

- **WHEN** Harness 发出工具开始、进度、结果或失败事件
- **THEN** 系统 SHALL 使用可编辑的状态或结果 card 展示工具名、阶段和脱敏摘要；有原生媒体结果时 SHALL 按媒体类型交付

#### Scenario: 未支持的媒体

- **WHEN** Harness 输出 Telegram 不支持或无法读取的媒体类型
- **THEN** 系统 SHALL 发送明确的不可交付提示和可用的脱敏元信息，不得静默丢弃或伪装为普通文本成功交付

### Requirement: 代理与生命周期

系统 SHALL 支持可选择 SOCKS5、HTTP 或 HTTPS Proxy，并通过 Bot SDK 的可注入 fetch transport 应用于 Bot API 和文件下载。插件启用状态、普通配置或 Bot Token 发生更新时，系统 SHALL 串行停止旧 runtime 并按最新完整配置启动新 runtime；同一插件实例在任何时刻最多只能有一个活动 polling 客户端。

#### Scenario: 代理连接

- **GIVEN** 配置包含有效 Proxy 协议、地址和端口参数
- **WHEN** Telegram Runtime 启动
- **THEN** 系统 SHALL 使用该代理建立 Bot API 连接

#### Scenario: 无效代理配置

- **GIVEN** Proxy 地址或端口不符合配置约束
- **WHEN** Telegram Runtime 准备启动
- **THEN** 系统 SHALL 在创建客户端前报告配置错误，且不得启动未配置完整的连接

#### Scenario: 配置更新

- **GIVEN** Telegram Runtime 正在运行
- **WHEN** Loader 接受 Workspace、Owner、Proxy、消息限制或启用状态的在线配置更新
- **THEN** 系统 SHALL 等待旧 runtime 完成清理，再依据最新完整配置启动至多一个新 runtime

#### Scenario: 仅 Bot Token 更新

- **GIVEN** Telegram Runtime 正在运行且其他配置没有变化
- **WHEN** `DSH_TELEGRAM_BOT_TOKEN` 凭据成功更新
- **THEN** 系统 SHALL 使用新 Token 串行重建 runtime，旧 Token 对应的 polling 客户端 MUST 在新客户端接收更新前停止

#### Scenario: 连续配置更新合并到最新状态

- **GIVEN** 前一次 runtime 重建尚未完成
- **WHEN** Host 又提交一次配置或凭据更新
- **THEN** 系统 SHALL 序列化重建并最终只运行最新配置，不得遗留中间配置对应的活动客户端

#### Scenario: 停止插件

- **GIVEN** 插件正在运行或重建 runtime
- **WHEN** 插件被禁用、Loader entry 卸载或 Host 关闭
- **THEN** 系统 SHALL 停止接收新消息、等待清理完成并保证不再启动排队中的旧配置

### Requirement: 凭据保护

系统 SHALL 将 Bot Token 存储在 Harness credentials 中，其他非敏感配置存储在 dsh `0.2.0-rc.2` Loader Settings 中，日志和状态接口不得输出 Token 原文。Plugin Manager 中的 Telegram row 配置页 SHALL 使用当前 credentials RPC 读写脱敏凭据状态，并通过 Host 配置表单原子提交非敏感字段。保存启用状态前 MUST 确认 Token 已配置；失败反馈 SHALL 可操作且不得泄露凭据。

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

### Requirement: 模型清单展示

系统 SHALL 在用户发送不带参数的 `/model` 时，按 provider 分组列出所有已注册且可路由 provider 及其模型目录。每个模型 SHALL 以单行呈现为一条完整可发送的 `/model <provider> <model>` 命令，并置于可一键复制的等宽实体内，使选择模型只需复制该行并发送。清单 SHALL 标注当前生效的模型选择。清单 SHALL 按 `messageLimit` 以行为最小单位分片，使任一分片内的富文本标签保持完整配对，不得使用不分片的 card 路径，也不得按字符切分。清单中所有来自 provider 的动态值 SHALL 经过转义，畸形的 provider 名或模型 ID MUST NOT 破坏消息的标签结构。单个 provider 的目录查询失败 MUST NOT 中断整个清单，SHALL 就地标注该 provider 不可用并继续列出其余 provider。

#### Scenario: 列出可用模型

- **GIVEN** dsh 已注册一个或多个 provider 且其模型目录可读
- **WHEN** Owner 发送不带参数的 `/model`
- **THEN** 系统 SHALL 返回当前生效选择及按 provider 分组的模型清单，每个模型占一行且为一条完整可发送的 `/model <provider> <model>` 命令，当前生效项被标注

#### Scenario: 模型 ID 含富文本特殊字符

- **GIVEN** 某 provider 的名称或模型 ID 含富文本标签字符
- **WHEN** Owner 发送不带参数的 `/model`
- **THEN** 系统 SHALL 转义这些字符后再渲染，消息的标签结构 MUST NOT 被破坏

#### Scenario: 清单超出单条消息限制

- **GIVEN** 模型清单文本长度超过配置的 `messageLimit`
- **WHEN** 系统交付该清单
- **THEN** 系统 SHALL 以行为最小单位拆分为多条消息发送，每条不超过 `messageLimit` 且其中的富文本标签保持完整配对，不得截断内容或发送格式损坏的消息

#### Scenario: 单个 provider 目录不可用

- **GIVEN** 某个已注册 provider 的模型目录查询抛错或超时
- **WHEN** Owner 发送不带参数的 `/model`
- **THEN** 系统 SHALL 在清单中标注该 provider 不可用并附脱敏原因，同时正常列出其余 provider 的模型

#### Scenario: 没有可路由 provider

- **GIVEN** dsh 当前没有任何已注册 provider
- **WHEN** Owner 发送不带参数的 `/model`
- **THEN** 系统 SHALL 返回「没有可用 provider」的明确提示，不得返回空消息或抛出未处理错误

### Requirement: 模型切换

系统 SHALL 在用户发送 `/model <provider> <model>` 时切换该私聊的模型选择。参数数量不等于二时 SHALL 返回用法提示且不改变任何状态。系统 SHALL 通过 dsh 官方 `ctx.llm.resolveModelInfo(provider, model)` 校验目标路由，MUST NOT 以「未出现在模型目录中」为唯一理由拒绝——dsh 规定模型目录是 advisory 且不控制请求路由。校验通过后系统 SHALL 同时做两件事：使当前存活 Session 的后续 step 使用新选择，且将该选择持久化到私聊绑定。校验失败时 SHALL 保持原选择不变。

#### Scenario: 切换到有效模型

- **GIVEN** Owner 私聊存在存活 Session，且目标 provider/model 通过 dsh 路由校验
- **WHEN** Owner 发送 `/model <provider> <model>`
- **THEN** 系统 SHALL 以 card 回复切换成功、使当前 Session 的下一个 step 使用新模型、保留既有对话历史、不创建新 Session，并将该选择持久化到私聊绑定

#### Scenario: 切换到不在目录中但可路由的模型

- **GIVEN** 目标模型未出现在 provider 的模型目录中，但 `resolveModelInfo` 确认该路由可用
- **WHEN** Owner 发送 `/model <provider> <model>`
- **THEN** 系统 SHALL 接受该切换，不得因目录缺失而拒绝

#### Scenario: 拒绝无效模型

- **GIVEN** 目标 provider 未注册，或 `resolveModelInfo` 判定该 provider/model 路由不可用
- **WHEN** Owner 发送 `/model <provider> <model>`
- **THEN** 系统 SHALL 返回脱敏的不可用提示，保持当前模型选择和绑定不变，且不得修改存活 Session 的选择

#### Scenario: 参数数量不正确

- **GIVEN** Owner 发送的 `/model` 携带一个参数或超过两个参数
- **WHEN** 系统解析该命令
- **THEN** 系统 SHALL 返回包含两种正确形态的用法提示，且不得推断 provider、不得改变任何状态

#### Scenario: 运行中任务期间切换

- **GIVEN** 当前 Session 存在运行中的 Agent turn
- **WHEN** Owner 发送有效的 `/model <provider> <model>`
- **THEN** 系统 SHALL 接受该选择并使其在后续 step 生效，不得中断或撤销当前正在进行的 turn

### Requirement: 模型选择继承

系统 SHALL 在创建或恢复 Session 时优先使用私聊绑定中持久化的完整模型选择；完整选择包括 provider、model 和可选 reasoning effort。绑定不含选择时 SHALL 回落到 `ctx.agentDefaultModel.currentSelection()` 的完整快照。私聊级选择 MUST NOT 写入 dsh 全局默认设置，不得影响 Web UI 或其他 Session。旧绑定缺少 reasoning effort 时 SHALL 保留 provider/model 并使用目标模型的默认 effort。

#### Scenario: 私聊级选择优先于全局默认

- **GIVEN** 私聊绑定持久化了完整模型选择，且它与 dsh 全局默认不同
- **WHEN** 系统为该私聊创建或恢复 Session
- **THEN** 系统 SHALL 使用私聊绑定中的 provider、model 和可选 reasoning effort，不得使用全局默认

#### Scenario: 无私聊级选择时回落

- **GIVEN** 私聊绑定不含模型选择
- **WHEN** 系统为该私聊创建或恢复 Session
- **THEN** 系统 SHALL 使用 `ctx.agentDefaultModel.currentSelection()` 的完整快照，包括其中的可选 reasoning effort

#### Scenario: 兼容旧绑定

- **GIVEN** 私聊绑定只包含 provider 和 model，没有 reasoning effort
- **WHEN** 系统读取绑定并创建或恢复 Session
- **THEN** 系统 SHALL 保留该 provider/model，并让目标模型使用 provider 或模型的默认 reasoning effort，不得拒绝或迁移该绑定

#### Scenario: 不污染全局设置

- **GIVEN** Owner 通过 `/model` 切换了模型
- **WHEN** 切换完成
- **THEN** 系统 MUST NOT 调用全局默认模型的保存接口，dsh 全局默认设置和其他 Session 的模型选择 SHALL 保持不变

#### Scenario: 重启后恢复选择

- **GIVEN** 私聊绑定已持久化完整模型选择，随后 Runtime 重启
- **WHEN** Owner 再次发送普通消息
- **THEN** 系统 SHALL 使用该持久化选择恢复或创建 Session，不得回落到全局默认

#### Scenario: 持久化选择已失效

- **GIVEN** 绑定中持久化的 provider/model 在当前部署下已不可路由
- **WHEN** 系统为该私聊创建或恢复 Session
- **THEN** 系统 SHALL 回落到全局默认模型创建 Session，并向 Owner 发送一次明确提示说明原选择已不可用，不得静默降级
