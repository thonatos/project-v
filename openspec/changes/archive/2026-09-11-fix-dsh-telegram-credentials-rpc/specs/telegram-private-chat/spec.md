## ADDED Requirements

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

## MODIFIED Requirements

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
