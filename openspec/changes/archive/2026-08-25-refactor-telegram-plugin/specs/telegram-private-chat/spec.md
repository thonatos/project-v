## MODIFIED Requirements

### Requirement: 私聊会话路由

系统 SHALL 将单个 Telegram Bot 绑定到一个已验证的 Workspace，并按 Telegram 私聊用户 ID 持久化到 Harness Session ID 的绑定。绑定 SHALL 通过 dsh 官方 storage 子系统（`ctx.storageDomain`）持久化，不得由插件自行向工作目录或任意文件路径写入状态文件。所有创建或恢复的 Session MUST 属于该 Bot 绑定的 Workspace。

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

#### Scenario: 绑定持久化落地

- **WHEN** 系统创建、替换或删除某私聊用户的 Session 绑定
- **THEN** 系统 SHALL 通过 storage 子系统持久化该变更，使 runtime 重启后能恢复既有绑定，且不得在项目工作目录留下状态文件

### Requirement: 出站消息交付

系统 SHALL 将 Harness 文本输出发送到对应 Telegram 私聊，使用可配置的 `messageLimit` 控制单条消息长度，并 SHALL 支持在输出增长期间编辑已发送消息。文本正文 SHALL 以富文本渲染交付：将 Markdown 转换为 Telegram 支持的受限 HTML 标签子集并使用 HTML parse mode 发送；当渲染结果被 Telegram 拒绝时，系统 SHALL 降级为纯文本发送，不得使消息交付失败。`messageLimit` 默认 SHALL 为 4096，且不得超过 Telegram `sendMessage` 的 4096 字符上限。

#### Scenario: 普通回复

- **WHEN** Harness 为当前 Turn 产生最终文本
- **THEN** 系统 SHALL 将文本发送到发起该 Turn 的私聊，并保留回复消息 ID

#### Scenario: 流式回复

- **WHEN** Harness 产生多个增量文本事件
- **THEN** 系统 SHALL 优先编辑已发送消息展示最新内容，并在编辑不可用时发送新的文本消息

#### Scenario: 富文本渲染

- **WHEN** Harness 文本包含 Markdown 标记（如粗体、行内代码、代码块、链接）
- **THEN** 系统 SHALL 将其渲染为 Telegram 支持的受限 HTML 交付，使标记生效而非以字面文本展示

#### Scenario: 渲染降级

- **WHEN** 富文本渲染结果被 Telegram 拒绝（例如流式分片切断了标签）
- **THEN** 系统 SHALL 降级为纯文本发送同一内容，不得丢弃该次输出或使 Turn 失败

#### Scenario: 超长回复

- **WHEN** 输出超过配置的 `messageLimit`
- **THEN** 系统 SHALL 按安全边界拆分为多条消息，且不得截断 Unicode 字符或发送超过 Telegram 上限的请求

#### Scenario: 自定义消息长度

- **WHEN** 用户在 dsh 内置 Settings 中将 `messageLimit` 设置为不超过 4096 的有效值
- **THEN** 系统 SHALL 使用该值限制普通回复和流式编辑消息的长度

#### Scenario: 无效消息长度

- **WHEN** `messageLimit` 不是正整数或大于 4096
- **THEN** 系统 SHALL 拒绝保存或启动配置，并通过内置 Settings 报告可操作的配置错误

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
