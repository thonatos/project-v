## MODIFIED Requirements

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
