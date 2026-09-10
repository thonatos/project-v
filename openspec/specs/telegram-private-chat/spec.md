# telegram-private-chat Specification

## Purpose
定义 DeepSeek Harness 的 Telegram 私聊插件运行时行为：通过 `node-telegram-bot-api` 接入单个 Bot，以 Bot API long polling 接收和发送私聊消息，将单个 Bot 绑定到一个 Workspace 并按私聊用户持久化 Harness Session 路由，限制 Owner 私聊访问，支持基础命令、媒体、出站类型映射、Harness 交互路由、代理与生命周期管理以及凭据保护。

## Requirements

### Requirement: 插件单次注册与启动

系统 SHALL 为已安装到 dsh profile 的 `dsh-telegram` 保留包内 bundle patch，使 dsh 能自动注册插件；常规启动不得再通过命令行重复应用同一 Telegram patch。最终组合后的插件树 MUST 只包含一个 `id: dsh-telegram`。显式 `--patch` 模式仅可用于插件尚未安装到目标 profile 的隔离开发场景。

#### Scenario: 已安装插件正常启动

- **GIVEN** `@implementsio/dsh-telegram` 已安装到目标 dsh profile，且包清单声明 `dsh.bundle.patch`
- **WHEN** 用户运行 `dsh web` 或 `dsh --profile web`
- **THEN** 系统 SHALL 通过包内 patch 自动注册并加载一次 `dsh-telegram`

#### Scenario: 防止重复注册

- **GIVEN** `@implementsio/dsh-telegram` 已安装到目标 dsh profile
- **WHEN** 生成或验证最终插件树
- **THEN** 文档和验证流程 SHALL 要求不再额外传入同一 `cordis.patch.yml`，且最终插件树 MUST 只出现一个 `id: dsh-telegram`

#### Scenario: 未安装插件的隔离开发

- **GIVEN** `@implementsio/dsh-telegram` 尚未安装到目标 dsh profile
- **WHEN** 开发者需要临时加载本地插件
- **THEN** 系统 MAY 允许显式应用本地 `cordis.patch.yml`，但该模式 MUST 与 profile 安装模式互斥

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

系统 SHALL 将单个 Telegram Bot 默认绑定到一个已验证的 Workspace，并按 Telegram 私聊用户 ID 持久化到 Harness Session ID 和当前 Workspace ID 的绑定。绑定 SHALL 通过 dsh 官方 storage 子系统（`ctx.storageDomain`）持久化，不得由插件自行向工作目录或任意文件路径写入状态文件。所有创建或恢复的 Session MUST 属于该私聊当前绑定的 Workspace；没有有效私聊绑定时 SHALL 使用 Bot 配置的默认 Workspace。

#### Scenario: 首条普通消息

- **GIVEN** 已授权私聊用户不存在持久化绑定
- **WHEN** 用户发送普通文本
- **THEN** 系统 SHALL 在 Bot 默认 Workspace 下创建 Harness Session、保存含 Workspace ID 的绑定并将文本提交到该 Session

#### Scenario: 已有绑定

- **GIVEN** 已授权私聊用户已有含 Session ID 和 Workspace ID 的绑定
- **WHEN** 用户发送普通文本
- **THEN** 系统 SHALL 验证 Workspace 仍已登记且 Session cwd 属于该 Workspace 后恢复它，不得创建第二个 Session

#### Scenario: 新建会话

- **GIVEN** 私聊已绑定一个有效 Workspace
- **WHEN** 用户发送 `/new`
- **THEN** 系统 SHALL 在当前绑定的 Workspace 下创建新的 Harness Session、替换当前私聊绑定并回复新会话已建立

#### Scenario: Workspace 配置变更

- **GIVEN** Bot 配置的默认 Workspace 被修改
- **WHEN** Runtime 重新启动且私聊没有其他有效 Workspace 绑定
- **THEN** 系统 SHALL 只允许在新默认 Workspace 下创建或恢复 Session

#### Scenario: Workspace 不可用

- **GIVEN** Bot 配置的默认 Workspace 不存在、未登记或不在 Harness 允许范围内
- **WHEN** 插件尝试启动 Telegram Runtime
- **THEN** 系统 SHALL 拒绝启动，并通过内置 Settings 状态报告可操作的 Workspace 配置错误

#### Scenario: 绑定持久化落地

- **GIVEN** 系统需要创建、替换、切换或删除某私聊用户的 Session 绑定
- **WHEN** 绑定发生变更
- **THEN** 系统 SHALL 通过 storage 子系统持久化该变更，使 Runtime 重启后能恢复 Session 和当前 Workspace，且不得在项目工作目录留下状态文件

#### Scenario: 绑定 Workspace 失效

- **GIVEN** 持久化绑定引用的 Workspace 已被删除或目录不可用
- **WHEN** 用户再次发送普通消息
- **THEN** 系统 SHALL 使该绑定失效并回退到已验证的默认 Workspace 创建新 Session，不得恢复到错误目录

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

系统 SHALL 支持 `/new`、`/status`、`/stop`、`/help` 和 `/workspace` 五个 Telegram 命令，并 SHALL 在 Bot 启动时通过 Telegram Bot API 将这些命令注册到 direct message、group chat 和 group administrators 标准 scope；命令展示范围不得放宽 Runtime 的 Owner 私聊访问控制。其他以 `/` 开头的输入 SHALL 返回“不支持的命令”，不得自动转发到 Harness，不得执行未注册的任意代码或 Shell 文本。所有控制命令结果 SHALL 使用结构化 Telegram card 交付，不得使用普通 Agent 文本交付路径。

#### Scenario: 注册命令菜单

- **GIVEN** Bot 身份和 webhook 状态已验证
- **WHEN** Telegram 客户端启动 long polling
- **THEN** 系统 SHALL 清空 default、direct message、group chat、group administrators 和旧版 Owner chat scope 中已有命令，再仅向 direct message、group chat 和 group administrators 三个标准 scope 分别注册五个支持命令及描述

#### Scenario: 查看状态

- **GIVEN** Owner 私聊已有或可创建有效绑定
- **WHEN** 用户发送 `/status`
- **THEN** 系统 SHALL 以结构化 Telegram card 回复连接状态、当前 Workspace、当前 Session、最近一次 Harness 状态和可用控制操作，且不得泄露凭据

#### Scenario: 停止任务

- **GIVEN** 当前 Session 存在运行中的任务
- **WHEN** 用户发送 `/stop`
- **THEN** 系统 SHALL 请求 Harness 停止该任务并回复处理结果

#### Scenario: 帮助命令

- **GIVEN** Owner 已连接 Bot 私聊
- **WHEN** 用户发送 `/help`
- **THEN** 系统 SHALL 以结构化 Telegram card 返回五个支持命令的列表及私聊范围说明

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

系统 SHALL 将 Bot Token 存储在 Harness credentials 中，其他非敏感配置可以存储在普通 Settings 中，日志和状态接口不得输出 Token 原文。dsh 内置 Settings 中的 Telegram 设置页 SHALL 使用当前 credentials RPC 契约读取 Bot Token 的脱敏配置状态并写入新 Token；读取结果只能包含 `configured`、`writable`、`source` 等凭据元信息，不得将已存储 Token 返回客户端。RPC 失败 SHALL 产生可操作且不泄露凭据值的错误反馈。

#### Scenario: 缺少登录材料

- **GIVEN** Telegram 插件尚未配置有效 Bot Token
- **WHEN** 用户启用插件或尝试保存启用状态
- **THEN** 系统 SHALL 进入错误状态并提供可操作的配置错误，不得启动半初始化客户端

#### Scenario: 读取凭据状态

- **GIVEN** dsh Host 已挂载 credentials provider
- **WHEN** Telegram 设置页读取 `DSH_TELEGRAM_BOT_TOKEN` 状态
- **THEN** 系统 SHALL 通过当前 credentials RPC 的引用数组参数读取状态，并只向页面提供该引用的脱敏元信息，不得返回 Token 原文

#### Scenario: 保存 Bot Token

- **GIVEN** 用户在 Telegram 设置页输入非空 Bot Token
- **WHEN** 用户保存设置
- **THEN** 系统 SHALL 通过当前 credentials RPC 的 `ref` 与 `value` 位置参数写入 Token，并在脱敏状态确认 `configured` 后才允许重新启用 Telegram runtime

#### Scenario: 凭据 RPC 失败

- **GIVEN** credentials RPC 返回失败结果或调用异常
- **WHEN** Telegram 设置页读取或写入 Bot Token
- **THEN** 系统 SHALL 显示能区分读取或写入阶段的错误反馈，并且错误文本、日志和 UI 状态不得包含 Token 原文

#### Scenario: 状态查询

- **GIVEN** Bot Token 已配置
- **WHEN** UI 或 `/status` 查询连接状态
- **THEN** 系统 SHALL 返回脱敏的连接信息，不得包含 Bot Token
