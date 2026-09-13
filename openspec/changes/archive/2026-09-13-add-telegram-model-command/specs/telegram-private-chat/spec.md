## MODIFIED Requirements

### Requirement: 私聊会话路由

系统 SHALL 将单个 Telegram Bot 默认绑定到一个已验证的 Workspace，并按 Telegram 私聊用户 ID 持久化到 Harness Session ID、当前 Workspace ID 和可选的当前模型选择的绑定。绑定 SHALL 通过 dsh 官方 storage 子系统（`ctx.storageDomain`）持久化，不得由插件自行向工作目录或任意文件路径写入状态文件。所有创建或恢复的 Session MUST 属于该私聊当前绑定的 Workspace；没有有效私聊绑定时 SHALL 使用 Bot 配置的默认 Workspace。任何写入绑定的代码路径 MUST 保留该绑定中当前不由自己负责的既有字段，不得整对象覆盖导致其他字段被静默丢弃。

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
- **THEN** 系统 SHALL 在当前绑定的 Workspace 下创建新的 Harness Session、替换当前私聊绑定并回复新会话已建立，且 SHALL 沿用该绑定已持久化的模型选择

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
- **THEN** 系统 SHALL 通过 storage 子系统持久化该变更，使 Runtime 重启后能恢复 Session、当前 Workspace 和当前模型选择，且不得在项目工作目录留下状态文件

#### Scenario: 绑定 Workspace 失效

- **GIVEN** 持久化绑定引用的 Workspace 已被删除或目录不可用
- **WHEN** 用户再次发送普通消息
- **THEN** 系统 SHALL 使该绑定失效并回退到已验证的默认 Workspace 创建新 Session，不得恢复到错误目录

#### Scenario: 切换 Workspace 保留模型选择

- **GIVEN** 私聊绑定已持久化一个模型选择
- **WHEN** 用户切换 Workspace，导致系统创建新 Session 并替换绑定
- **THEN** 系统 SHALL 在新绑定中保留原有模型选择，并使新 Session 使用该选择

#### Scenario: Session resume 失败重建保留模型选择

- **GIVEN** 私聊绑定已持久化一个模型选择，但其 Session 无法 resume
- **WHEN** 系统删除失效绑定并在当前 Workspace 重建 Session
- **THEN** 系统 SHALL 使重建后的绑定保留原有模型选择，不得回落到全局默认模型

### Requirement: 基础命令

系统 SHALL 支持 `/new`、`/status`、`/stop`、`/help`、`/workspace` 和 `/model` 六个 Telegram 命令，并 SHALL 在 Bot 启动时通过 Telegram Bot API 将这些命令注册到 direct message、group chat 和 group administrators 标准 scope。命令清单 SHALL 只有一处定义，Telegram 命令菜单、`/help` 与「不支持的命令」提示 SHALL 全部由该来源派生，不得各自维护副本。命令 SHALL 按名称长度升序排列，同长度保持定义顺序，使最长的 `/workspace` 位于末尾；该顺序 SHALL 在三处呈现中保持一致。每个命令 SHALL 携带非空描述。命令展示范围不得放宽 Runtime 的 Owner 私聊访问控制。其他以 `/` 开头的输入 SHALL 返回“不支持的命令”，不得自动转发到 Harness，不得执行未注册的任意代码或 Shell 文本。除模型清单外，所有控制命令结果 SHALL 使用结构化 Telegram card 交付，不得使用普通 Agent 文本交付路径；模型清单因长度不可预测 SHALL 使用按行分片的消息交付路径，不得使用不分片的 card 路径。

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

## ADDED Requirements

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

系统 SHALL 在创建或恢复 Session 时，优先使用该私聊绑定中持久化的模型选择；绑定不含模型选择时 SHALL 回落到 `ctx.agentDefaultModel.currentSelection()`。私聊级选择 MUST NOT 写入 dsh 全局默认模型设置，不得影响 Web UI 或其他 Session。

#### Scenario: 私聊级选择优先于全局默认

- **GIVEN** 私聊绑定持久化了模型选择，且它与 dsh 全局默认不同
- **WHEN** 系统为该私聊创建或恢复 Session
- **THEN** 系统 SHALL 使用私聊绑定中的选择，不得使用全局默认

#### Scenario: 无私聊级选择时回落

- **GIVEN** 私聊绑定不含模型选择
- **WHEN** 系统为该私聊创建或恢复 Session
- **THEN** 系统 SHALL 使用 `ctx.agentDefaultModel.currentSelection()` 的快照

#### Scenario: 不污染全局设置

- **GIVEN** Owner 通过 `/model` 切换了模型
- **WHEN** 切换完成
- **THEN** 系统 MUST NOT 调用全局默认模型的保存接口，dsh 全局默认设置和其他 Session 的模型选择 SHALL 保持不变

#### Scenario: 重启后恢复选择

- **GIVEN** 私聊绑定已持久化模型选择，随后 Runtime 重启
- **WHEN** Owner 再次发送普通消息
- **THEN** 系统 SHALL 使用该持久化选择恢复或创建 Session，不得回落到全局默认

#### Scenario: 持久化选择已失效

- **GIVEN** 绑定中持久化的 provider/model 在当前部署下已不可路由
- **WHEN** 系统为该私聊创建或恢复 Session
- **THEN** 系统 SHALL 回落到全局默认模型创建 Session，并向 Owner 发送一次明确提示说明原选择已不可用，不得静默降级
