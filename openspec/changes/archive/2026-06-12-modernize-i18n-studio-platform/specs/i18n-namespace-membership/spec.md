## ADDED Requirements

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
