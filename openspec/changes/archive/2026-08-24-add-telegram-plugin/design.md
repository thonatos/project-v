## Context

仓库当前没有轻量的单 Bot dsh Telegram 插件。实现采用 `node-telegram-bot-api` 的 Bot API long polling，只需要 Bot Token，不要求 Telegram App API ID、API Hash 或 String Session。

正式源码和 package manifest 放在 `packages/plugins/dsh-telegram/`，并将 `packages/plugins/*` 纳入 pnpm workspace。该插件是可独立构建和发布的 Host/Client 扩展包；Cordis patch 文件也放在该插件目录中，测试直接引用真实文件，不再使用 `scratch-plugin/` 示例目录。

插件运行在 Harness Host 进程中，需要接入插件生命周期、配置和 credentials，并将 Telegram 对话路由到 Harness 原生 Workspace/Agent/Session。首版只处理私聊和一个 Bot，避免引入群组权限、线程模型和多 Bot 管理。

## Goals / Non-Goals

**Goals:**

- 使用 `node-telegram-bot-api@2.0.0` 建立单个 Bot API long polling 连接。
- 支持 long polling 重试和可选择协议的 Proxy 配置。
- 将私聊消息稳定映射到 Harness Session，并支持新建、恢复和停止任务。
- 支持基础命令、长文本分片、编辑消息式流式回复和文件边界的可扩展设计。
- 控制命令与普通消息分离，使用请求 ownership 校验 Harness Turn 后执行停止或 steering。
- 将 Harness 审批和用户问题映射为 Telegram inline keyboard card，并为不支持回调或回调失败的情况提供文字降级。
- 在配置变化和插件停用时可靠释放客户端、事件处理器和持久化状态。

**Non-Goals:**

- 不支持用户账号登录、验证码、2FA 或交互式授权。
- 不支持群组、频道、Topic、多 Bot 或 webhook。
- 不复制 `dsh-im` 的统一多渠道抽象、跨渠道 RPC 和完整控制命令集。
- 不复制 `dsh-im` 的 HTTP/RPC Harness client；只复用其 fast command、ownership 和 interaction queue 的行为模型。
- 不实现自定义 Settings React 页面、独立配置卡片或插件专用 UI 组件。
- 不在首版实现 Telegram 所有媒体类型或普通文件入站。

## Decisions

### 1. 使用 Bot SDK long polling

通过 `node-telegram-bot-api` 的 `Bot`、`getMe` 和 `startPolling()` 验证身份并接收更新。处理器显式过滤非私聊、非 Owner 和自身 Bot 消息。启动时检测现有 Webhook，避免 Webhook 与 long polling 冲突。

替代方案：使用 GramJS/MTProto。该方案要求额外配置 API ID、API Hash 和 String Session，不符合只配置 Bot Token 的产品要求。

### 2. 分离配置和敏感凭据

普通配置保存引用和非敏感运行参数：

```text
enabled
workspaceId
ownerUserId
proxy
messageLimit
```

Bot Token 保存到固定的 Harness credential reference；该内部引用不显示在 UI，也不写入插件 Settings。其他字段保存为普通设置。

替代方案：把 Bot Token 放普通设置中。该方案会泄露 secret，因此不采用。

### 3. 使用 dsh 内置 Settings UI

插件通过官方 `settings.plugin.item` keyed slot 注册配置卡片，并使用 `settingsScope` 保存普通配置。Bot Token 由卡片通过 credentials API 直接读写；界面只读取 configured/writable 状态，不回显 secret 或内部引用。Workspace 使用客户端 Workspace 服务提供的真实列表。

替代方案：仿照 `dsh-im` 为 Telegram 编写独立设置卡片。该方案会重复宿主 UI 能力，并造成样式、权限和配置保存行为分叉，因此不采用。

### 4. 将 Bot 绑定到单个 Workspace

配置必须包含一个已存在且通过 Harness 校验的 `workspaceId`（或其规范化路径，具体以 Host Settings API 的字段类型为准）。Bot runtime 启动时验证绑定 Workspace；所有由该 Bot 创建或恢复的 Session 都必须通过该 Workspace 创建，不允许 Telegram 命令改变 Workspace。

`/new` 只清理或替换当前私聊的 Session binding，然后在 Bot 绑定的同一 Workspace 下创建新 Session。Workspace 配置变更是宿主级配置变更，必须先停止 runtime，再清理不再属于新 Workspace 的旧路由，最后重启连接；不得将旧 Workspace 的 Session 绑定继续用于新 Workspace。

替代方案：把 Workspace 仅作为首次创建 Session 的默认值。该方案允许绑定漂移，无法保证一个 Bot 的会话始终归属同一 Workspace，因此不采用。

### 5. 使用单一 ownerUserId 保护私聊入口

首版配置必须包含一个 Telegram `ownerUserId`。runtime 只接受 `message.isPrivate === true` 且 `senderId` 等于该值的消息；其他私聊消息和所有群组/频道消息都忽略，不创建 Session，也不返回 Harness 状态。这样不会把本地 Workspace 暴露给任意能找到 Bot 的用户。

替代方案：允许所有私聊用户或实现可配置多用户 allowlist。前者不满足本地 Harness 的安全边界，后者增加首版配置和授权管理复杂度，因此暂不采用。

### 6. 使用一条私聊路由键保存 Conversation Binding

首版以 Telegram 私聊用户 ID 作为 `conversationKey`，持久化映射到 Harness Session ID，并额外记录绑定时的 Workspace 标识用于一致性校验。收到 `/new` 时在 Bot 绑定 Workspace 下创建新 Session 并替换绑定；普通消息恢复已有 Session，不存在时也只能在 Bot 绑定 Workspace 下创建。

替代方案：每条消息创建临时 Session。该方案无法保持上下文，且会增加 Harness 资源泄漏风险。

### 7. 支持基础媒体和 caption

首版支持 Telegram 图片的入站消息。图片的 `caption` 作为文本输入，图片通过 `ctx.attachments.saveImage()` 持久化为 Harness `ImageAttachmentRef`；没有 caption 的图片消息仍然可以提交。首版出站支持 Harness 已登记的图片产物，通过 `ctx.attachments.readImage()` 读取后交给 Bot SDK `sendPhoto`，并将文本作为 Telegram caption；普通文件和无法识别或超出 Telegram 限制的媒体明确报错，不静默丢弃。

替代方案：首版只转发文本。该方案无法满足 Telegram 图片和 caption 的基本使用场景，因此不采用。

### 8. 普通回复与控制命令分离

普通消息进入每个聊天自己的串行队列；`/stop` 和后续控制命令进入独立 fast path，不等待前一个模型回复完成。每次普通请求记录自己的 ownership token、Session ID 和 Turn 标识，控制命令必须验证该 ownership 仍然 active 后才调用 Harness Agent 的取消或 steering API。

停止使用 Harness 支持的保留 inbox 语义，避免误删已经排队但尚未执行的消息。任务已结束、ownership 不属于当前聊天或 Session 已失效时，返回“当前没有正在运行的任务”，不得伪造成功。

### 9. Harness interaction 与 Telegram card

审批和用户问题属于 Harness interaction，不作为普通文本消息重新提交给模型。runtime 为每个聊天维护 pending interaction queue，按 Harness 的问题优先级处理回复。

Telegram 优先使用 inline keyboard：审批提供“批准/拒绝”，单选问题提供选项按钮，多选问题提供可切换选项和“提交”按钮；用户也可以使用文字回复作为降级路径。回调必须绑定 interaction ID、聊天和发起用户，过期或重复回调只返回已处理提示。

Interaction 路由必须由 Telegram bridge 主动注册和消费，不能只依赖 dsh Web 的默认 interaction presenter。否则 Telegram 发起的 Turn 会把审批或问题显示到 Web，而 Telegram 用户无法继续任务。Bridge 需要处理 interaction opened、answered、resolved 和 stopped 生命周期，并在 Telegram card 与 Harness interaction 之间保留一一对应关系。

### 10. 出站消息类型映射

Bridge 不把 Harness 事件统一转换成纯文本，而是按内容类型选择 Telegram 交付类型：

| Harness 类型 | Telegram 交付 | 行为 |
| --- | --- | --- |
| `text` / Markdown 文本 | `sendMessage` + `editMessageText` | 普通回复首条发送、后续增量编辑，超长安全分片 |
| `image` | `sendPhoto` | 从 attachment 读取二进制，caption 只承载对应文本 |
| `audio` | `sendAudio` | 从 artifact/attachment 读取并发送原生音频 |
| `video` | `sendVideo` | 从 artifact/attachment 读取并发送原生视频 |
| `file` / `document` | `sendDocument` | 保留文件名和可选 caption |
| `tool_start` / `tool_update` | 状态 card | 显示工具名、阶段和可安全展示的摘要，优先编辑同一条状态消息 |
| `tool_result` | 结果消息或原生媒体 | 有媒体时按媒体类型发送，否则发送摘要文本 |
| `tool_error` | 错误 card | 显示脱敏错误，不输出原始堆栈或 secret |
| `approval` | inline keyboard card | 绑定 interaction ID，提供批准/拒绝 |
| `question` | inline keyboard card | 选项使用按钮，多选使用选择后提交 |
| 未知类型 | 安全文本降级 | 记录类型诊断，不丢弃用户可理解的信息 |

只有明确属于文本的内容才允许走普通文本回复。工具事件不得作为原始 JSON 或无上下文文本直接发送；需要用户输入的工具调用必须升级为 approval card。Telegram 不支持的媒体类型必须明确显示不可交付状态，而不是静默转成空文本。

### 11. 出站回复使用“首条发送、后续编辑、超长分片”

插件提供 `messageLimit` 设置，默认 4096，允许用户配置更小的正整数值，但不得超过 Telegram 的 4096 字符上限。Harness 增量事件进入 Telegram 适配层后可通过 Bot API 发送或编辑消息；超过 `messageLimit` 时关闭当前片段并发送下一片。

分片必须避免截断 Unicode 字符，并尽量在换行或代码块边界切分；如果格式化文本无法安全保持格式，必须降级为纯文本，而不是发送一个会被 Telegram 拒绝的请求。

该实现不把 Telegram Rich Message 类型暴露给 Harness 核心。后续原生交互仍在适配层完成。

### 12. Proxy 使用 SOCKS5 fetch transport

配置支持 SOCKS5、HTTP、HTTPS 协议，以及地址、端口和可选认证字段。插件通过 `proxy-agent` 创建 fetch transport，并同时用于 Bot API 请求和 Telegram 文件下载。MTProxy 属于 MTProto，不在 Bot API 实现中展示或支持。

### 13. 生命周期采用可取消的 runtime 单例

插件每次只创建一个 `Bot`。`start` 负责验证身份、注册处理器和启动 polling；`stop` 中止 polling 并等待循环退出。配置更新使用 stop-then-start，禁止新旧客户端并行接收消息。

### 消息流

```text
Telegram Bot API
      │ long polling
      ▼
私聊过滤与命令解析
      │
       ├─ 本地命令 (/new, /status, /stop, /help)
      │
       └─ ConversationBinding
              │
              ▼
       Harness Session/Agent
              │ 增量事件
              ▼
       Telegram Message Adapter
              │ send/edit/chunk
              ▼
        Telegram 私聊
```

## Risks / Trade-offs

- [Bot Token 泄露] → 只通过 credentials 存取，UI 不回显值或内部引用，日志禁止打印 Token。
- [Webhook 冲突] → 启动前调用 `getWebhookInfo`，存在 Webhook 时明确报错而不是静默抢占更新。
- [消息编辑可能受 Telegram 限制或失败] → 捕获编辑异常并发送新消息；长消息使用安全分片，避免重复发送已确认内容。
- [配置更新期间可能有在途回复] → runtime 使用 AbortSignal 和 stop promise，重建前等待旧任务结束或标记其结果不可再投递。
- [Harness 实际 Agent/Session API 可能与 dsh-im 假设不同] → 实现前先以当前安装的 Host 类型和现有插件示例为准，禁止直接复制 dsh-im 的私有 RPC 客户端。

## Migration Plan

1. 在 `packages/plugins/dsh-telegram/` 安装并锁定 `node-telegram-bot-api@2.0.0`，实现 runtime、binding store、消息适配和 Host 注册。
2. 从该 package 生成可被 Cordis patch 引用的本地构建产物。
3. 使用 `pnpm dsh --profile web --patch ./packages/plugins/dsh-telegram/cordis.patch.yml` 启动本地 dsh web，在不发布 npm 包、不执行本地 link 的情况下加载插件。
4. 在 dsh 内置 Settings UI 中配置 Bot Token、绑定 Workspace、可选 SOCKS5 Proxy 和 `messageLimit`。
5. 通过私聊连接测试、`/new` 和普通消息验证登录、路由、回复和停止流程。
6. 回滚时禁用插件并停止 runtime；保留或删除 Telegram credentials 由用户决定，Harness 其他配置不变。

## Open Questions

- 当前 Harness Host 暴露的 Agent/Session 事件接口名称和增量输出格式需要在实现前确认。
- 内置 Settings schema 的注册方式、字段类型和状态写回接口需要以当前 dsh Host API 为准，不能假设存在通用 schema API。
