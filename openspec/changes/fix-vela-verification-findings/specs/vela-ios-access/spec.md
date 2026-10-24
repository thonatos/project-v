# Spec Delta

## ADDED Requirements

### Requirement: 启动期间首屏可用

iOS 应用启动时 SHALL 在后台启动私人网络节点，状态查询 MUST NOT 阻塞在节点启动上。节点尚未就绪时，连接状态 SHALL 呈现为「连接中」，首屏 SHALL 立即可用。

#### Scenario: 冷启动首屏

- **GIVEN** 应用刚启动且私人网络节点仍在启动
- **WHEN** 用户打开任意一个标签页
- **THEN** 界面 SHALL 立即渲染并显示「连接中」，MUST NOT 显示「未连接」或空白错误页

#### Scenario: 连接后自动补齐

- **GIVEN** 首屏已显示且节点随后连接成功
- **WHEN** 下一次状态轮询完成
- **THEN** 设备与服务 SHALL 自动出现，不需要用户手动刷新

#### Scenario: 节点启动失败

- **GIVEN** 私人网络节点启动失败
- **WHEN** 状态查询完成
- **THEN** 界面 SHALL 显示离线状态与可执行的重试操作，MUST NOT 停留在「连接中」

### Requirement: 开发签名有效期按实际时间表述

iOS 的「开发签名」说明 SHALL 根据描述文件的实际到期时间生成。剩余时间超过 7 天时 MUST NOT 声称「7 天有效」；临期与已过期时 SHALL 给出对应的续签提示。

#### Scenario: 长期描述文件

- **GIVEN** 描述文件的到期时间距离当前超过 7 天
- **WHEN** 用户查看开发签名区块
- **THEN** 界面 SHALL 显示到期日期，并说明覆盖安装不会清除设备身份与数据，MUST NOT 出现「7 天」说法

#### Scenario: 临期

- **GIVEN** 描述文件将在 7 天内到期
- **WHEN** 用户查看开发签名区块
- **THEN** 界面 SHALL 提示剩余天数，并说明到期前覆盖安装即可

#### Scenario: 已过期

- **GIVEN** 描述文件已经过期
- **WHEN** 用户查看开发签名区块
- **THEN** 界面 SHALL 提示签名已过期以及重新构建并覆盖安装的步骤

#### Scenario: 未嵌入描述文件

- **GIVEN** 构建中没有可读取的描述文件到期时间
- **WHEN** 用户查看开发签名区块
- **THEN** 界面 SHALL 说明未读取到签名信息，且覆盖安装不会清除设备身份与数据
