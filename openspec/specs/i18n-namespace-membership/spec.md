## Purpose

定义 i18n-studio 用户与命名空间间的成员关系契约:多对多绑定、admin/editor/viewer 三种角色、邀请/移除/调整角色的权限矩阵,以及"最后一名 admin 不可移除"的安全闸。
## Requirements
### Requirement: 用户—命名空间多对多关系

系统 SHALL 通过成员关系表维护用户与命名空间的多对多关联，每条记录 MUST 包含命名空间、用户与角色三元组，且 (namespace, user) 在表内唯一。

#### Scenario: 邀请用户加入命名空间

- **GIVEN** 命名空间管理员调用邀请接口，指定 user 与角色 `editor`
- **WHEN** 该用户尚未为该命名空间成员
- **THEN** 系统插入一条成员记录，角色为 `editor`

#### Scenario: 重复邀请

- **GIVEN** 用户已是命名空间成员
- **WHEN** 管理员再次邀请相同用户
- **THEN** 系统返回冲突错误，并提示通过 `PATCH /api/namespaces/:slug/members/:userId` 更新已有成员角色

### Requirement: 角色与权限矩阵

系统 SHALL 支持三种角色：`admin`、`editor`、`viewer`，并按下表强制授权：

| 操作 | admin | editor | viewer |
| ---- | ----- | ------ | ------ |
| 读取词条 / 导出（仅 published） | ✅ | ✅ | ✅ |
| 读取 draft 与翻译版本历史 | ✅ | ✅ | ✅ |
| 读取 draft（include=draft / status=draft） | ✅ | ✅ | ✅ |
| 创建/更新/删除词条（含 as_draft） | ✅ | ✅ | ❌ |
| Publish / discard 草稿 | ✅ | ✅ | ❌ |
| 回滚翻译到旧版本 | ✅ | ✅ | ❌ |
| 批量导入 | ✅ | ✅ | ❌ |
| 创建翻译任务 | ✅ | ✅ | ❌ |
| 取消翻译任务 | ✅ | ❌ | ❌ |
| 拉取/回写翻译任务（外部 job） | API token + 任意成员 | API token + 任意成员 | API token + 任意成员 |
| 通过 `/snapshot/:slug` 拉取（公开命名空间） | 任意来源（无需登录） | 同 | 同 |
| 通过 `/snapshot/:slug` 拉取（私有命名空间） | read-only token 持有者 | 同 | 同 |
| 配置 `public_read` / 签发/撤销 read-only token | ✅ | ❌ | ❌ |
| 发起跨空间同步（写目标，结果默认 draft） | ✅ | ✅ | ❌ |
| 同步时使用 `auto_publish=true` | ✅ | ✅ | ❌ |
| 配置语言列表 | ✅ | ❌ | ❌ |
| 邀请/移除/变更成员角色 | ✅ | ❌ | ❌ |
| 删除命名空间 | ✅ | ❌ | ❌ |

#### Scenario: viewer 写操作被拒

- **GIVEN** 用户在命名空间内角色为 `viewer`
- **WHEN** 该用户尝试创建或更新词条
- **THEN** 系统返回 403 Forbidden，不修改任何数据

#### Scenario: editor 配置语言被拒

- **GIVEN** 用户角色为 `editor`
- **WHEN** 该用户尝试调用语言配置接口
- **THEN** 系统返回 403 Forbidden

#### Scenario: admin 全权操作

- **GIVEN** 用户角色为 `admin`
- **WHEN** 执行权限矩阵中任意操作
- **THEN** 系统按业务规则正常处理

### Requirement: 角色变更与移除

系统 SHALL 提供成员角色更新与移除接口；MUST 防止命名空间出现零 admin 状态。

#### Scenario: 变更角色

- **GIVEN** 命名空间存在两个 admin
- **WHEN** 一个 admin 将另一名 admin 改为 editor
- **THEN** 系统更新角色，命名空间仍有至少一个 admin

#### Scenario: 拒绝移除最后一名 admin

- **GIVEN** 命名空间内仅剩一名 admin
- **WHEN** 试图将其改为 editor 或移除该成员
- **THEN** 系统拒绝操作并返回错误，避免命名空间失去管理者

#### Scenario: 用户被移除后失去访问

- **GIVEN** 用户为命名空间成员
- **WHEN** admin 移除其成员关系
- **THEN** 该用户后续对该命名空间的所有请求一律 403

### Requirement: 跨命名空间隔离

系统 SHALL 拒绝任何在用户不具备成员资格的命名空间下的资源操作请求。

#### Scenario: 非成员访问

- **GIVEN** 用户不在命名空间 A 中
- **WHEN** 用户携带凭证请求命名空间 A 的词条列表
- **THEN** 系统返回 404 或 403（不暴露存在性差异），不返回任何词条

### Requirement: Pending invitation 生命周期

系统 SHALL 支持 namespace pending invitation。管理员可按 email 创建邀请，邀请在接受前不创建 membership，且 MUST 支持过期、撤销、重发和接受。

#### Scenario: 邀请未注册用户

- **GIVEN** namespace admin 输入一个尚未注册的 email
- **WHEN** admin 创建邀请
- **THEN** 系统创建 pending invitation，MUST NOT 立即创建 membership

#### Scenario: 已注册用户接受邀请

- **GIVEN** 用户 email 与 pending invitation email 匹配
- **WHEN** 用户携带有效 invitation token 接受邀请
- **THEN** 系统创建 membership，标记 invitation 为 accepted，并记录 acceptedBy 与 acceptedAt

#### Scenario: 过期邀请不可接受

- **GIVEN** invitation 的 expiresAt 已早于当前时间
- **WHEN** 用户尝试接受该邀请
- **THEN** 系统拒绝请求，不创建 membership，并提示邀请已过期

#### Scenario: 重发邀请

- **GIVEN** 某 email 已存在 pending invitation
- **WHEN** admin 选择重发邀请
- **THEN** 系统刷新 invitation token 和 expiresAt，并保留同一 namespace/email 的唯一 pending 邀请语义

### Requirement: 成员与邀请审计

系统 SHALL 为邀请创建、邀请接受、邀请撤销、角色变更和成员移除写入 audit event。

#### Scenario: 创建邀请写审计

- **GIVEN** admin 创建 pending invitation
- **WHEN** 事务提交成功
- **THEN** 系统写入 audit event，记录 email、role、namespace 和 actor

#### Scenario: 角色变更写审计

- **GIVEN** admin 将成员从 editor 调整为 viewer
- **WHEN** 角色更新成功
- **THEN** 系统写入 audit event，记录 before.role 与 after.role

#### Scenario: 移除成员写审计

- **GIVEN** admin 移除 namespace 成员
- **WHEN** membership 删除成功
- **THEN** 系统写入 audit event，记录被移除 userId、email 和原 role

