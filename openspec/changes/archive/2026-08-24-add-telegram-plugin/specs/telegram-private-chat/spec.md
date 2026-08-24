## ADDED Requirements

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

系统 SHALL 将单个 Telegram Bot 绑定到一个已验证的 Workspace，并按 Telegram 私聊用户 ID 持久化到 Harness Session ID 的绑定。所有创建或恢复的 Session MUST 属于该 Bot 绑定的 Workspace。

#### Scenario: 首条普通消息

- **WHEN** 已授权私聊用户发送普通文本且不存在绑定
- **THEN** 系统 SHALL 在 Bot 绑定的 Workspace 下创建 Harness Session、保存绑定并将文本提交到该 Session

#### Scenario: 已有绑定

- **WHEN** 已授权私聊用户发送普通文本且已经存在绑定
- **THEN** 系统 SHALL 验证该 Session 仍属于 Bot 绑定的 Workspace 后恢复它，不得创建第二个 Session

#### Scenario: 新建会话

- **WHEN** 用户发送 `/new`
- **THEN** 系统 SHALL 在 Bot 绑定的同一 Workspace 下创建新的 Harness Session、替换当前私聊绑定并回复新会话已建立

#### Scenario: Workspace 配置变更

- **WHEN** Bot 绑定的 Workspace 被修改
- **THEN** 系统 SHALL 停止 runtime、使旧 Workspace 下的私聊 Session 路由失效，并只允许新连接创建或恢复新 Workspace 下的 Session

#### Scenario: Workspace 不可用

- **WHEN** Bot 未配置 Workspace，或配置的 Workspace 不存在、未登记或不在 Harness 允许范围内
- **THEN** 系统 SHALL 拒绝启动 Telegram runtime，并通过内置 Settings 状态报告可操作的 Workspace 配置错误

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

首版系统 SHALL 只支持 `/new`、`/status`、`/stop` 和 `/help` 四个 Telegram 命令；其他以 `/` 开头的输入 SHALL 作为普通文本处理或返回“不支持的命令”，不得自动转发到 Harness，不得执行未注册的任意代码或 Shell 文本。所有控制命令结果 SHALL 使用结构化 Telegram card 交付，不得使用普通 Agent 文本交付路径。

#### Scenario: 查看状态

- **WHEN** 用户发送 `/status`
- **THEN** 系统 SHALL 以结构化 Telegram card 回复连接状态、当前绑定状态、最近一次 Harness 状态和可用控制操作，且不得泄露凭据

#### Scenario: 停止任务

- **WHEN** 用户发送 `/stop` 且当前 Session 存在运行中的任务
- **THEN** 系统 SHALL 请求 Harness 停止该任务并回复处理结果

#### Scenario: 帮助命令

- **WHEN** 用户发送 `/help`
- **THEN** 系统 SHALL 以结构化 Telegram card 返回首版支持的命令列表及私聊范围说明

### Requirement: 出站消息交付

系统 SHALL 将 Harness 文本输出发送到对应 Telegram 私聊，使用可配置的 `messageLimit` 控制单条消息长度，并 SHALL 支持在输出增长期间编辑已发送消息。`messageLimit` 默认 SHALL 为 4096，且不得超过 Telegram `sendMessage` 的 4096 字符上限。

#### Scenario: 普通回复

- **WHEN** Harness 为当前 Turn 产生最终文本
- **THEN** 系统 SHALL 将文本发送到发起该 Turn 的私聊，并保留回复消息 ID

#### Scenario: 流式回复

- **WHEN** Harness 产生多个增量文本事件
- **THEN** 系统 SHALL 优先编辑已发送消息展示最新内容，并在编辑不可用时发送新的文本消息

#### Scenario: 超长回复

- **WHEN** 输出超过配置的 `messageLimit`
- **THEN** 系统 SHALL 按安全边界拆分为多条消息，且不得截断 Unicode 字符或发送超过 Telegram 上限的请求

#### Scenario: 自定义消息长度

- **WHEN** 用户在 dsh 内置 Settings 中将 `messageLimit` 设置为不超过 4096 的有效值
- **THEN** 系统 SHALL 使用该值限制普通回复和流式编辑消息的长度

#### Scenario: 无效消息长度

- **WHEN** `messageLimit` 不是正整数或大于 4096
- **THEN** 系统 SHALL 拒绝保存或启动配置，并通过内置 Settings 报告可操作的配置错误

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
- **THEN** 系统 SHALL 使用 Telegram 文本消息发送或编辑，并按 `messageLimit` 安全分片

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

系统 SHALL 支持可选择 SOCKS5、HTTP 或 HTTPS 协议的 Proxy，并通过 Bot SDK 的可注入 fetch transport 应用于 Bot API 和文件下载请求；系统 SHALL 在启动、停止和配置更新时清理 polling 客户端及消息处理器。

#### Scenario: 代理连接

- **WHEN** 配置包含有效 Proxy 协议、地址和端口参数
- **THEN** 系统 SHALL 使用该代理建立 Bot API 连接

#### Scenario: 无效代理配置

- **WHEN** Proxy 地址或端口不符合 SOCKS5 配置要求
- **THEN** 系统 SHALL 在创建客户端前报告配置错误，且不得启动未配置完整的连接

#### Scenario: 配置更新

- **WHEN** Bot 登录材料或 Proxy 配置发生变化
- **THEN** 系统 SHALL 停止旧客户端、移除旧事件处理器、创建新客户端并只允许新客户端接收更新

#### Scenario: 停止插件

- **WHEN** 插件被禁用或 Host 关闭
- **THEN** 系统 SHALL 停止接收新消息、断开 Telegram 客户端并等待 runtime 清理完成

### Requirement: 凭据保护

系统 SHALL 将 Bot Token 存储在 Harness credentials 中，其他非敏感配置可以存储在普通 Settings 中，日志和状态接口不得输出 Token 原文。

#### Scenario: 缺少登录材料

- **WHEN** 插件启用但任一必需登录材料缺失或格式无效
- **THEN** 系统 SHALL 进入错误状态并提供可操作的配置错误，不得启动半初始化客户端

#### Scenario: 状态查询

- **WHEN** UI 或 `/status` 查询连接状态
- **THEN** 系统 SHALL 返回脱敏的连接信息，不得包含 Bot Token
