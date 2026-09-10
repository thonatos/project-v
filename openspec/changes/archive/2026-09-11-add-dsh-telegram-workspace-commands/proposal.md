## Why

Telegram Bot 当前不会向客户端发布命令菜单，且每个私聊只能使用配置中的单一 Workspace。Owner 需要能从 Telegram 直接发现常用命令并切换已登记的 Workspace，而无需修改配置并重启插件。

## What Changes

- 启动 Bot 时向 Telegram 注册 `/new`、`/status`、`/stop`、`/help` 和 `/workspace` 命令。
- 新增无参数 `/workspace` 选择卡片，列出已登记 Workspace 并通过 inline callback 完成切换。
- `/new`、`/status` 和后续普通消息使用私聊绑定中的当前 Workspace；配置的 `workspaceId` 继续作为默认值和失效绑定的回退值。
- Workspace 切换继续受 Owner 私聊访问控制约束，不开放任意路径或未登记 Workspace。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `telegram-private-chat`：扩展基础命令和私聊 Session 路由，使单个 Owner 私聊可在已登记 Workspace 间安全切换。

## Impact

- 影响 `packages/plugins/dsh-telegram` 的 Telegram 客户端启动、命令解析、callback 路由、Session 创建/恢复、卡片渲染和测试。
- 不新增依赖，不改变现有绑定数据结构；继续使用 `{ sessionId, workspaceId }`。
- 回滚时移除命令注册与 `/workspace` 分支，并恢复只接受默认 Workspace 的路由；已有绑定仍可由旧逻辑识别，非默认 Workspace 绑定会按旧行为失效并回退。
