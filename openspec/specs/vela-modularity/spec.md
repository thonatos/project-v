# vela-modularity Specification

## Purpose

定义 Vela 的代码组织与共享边界：目录按「平台私有 / 共享 / 核心 / 工具」四类分区，跨平台能力只保留一份实现，使新增平台或修改共享行为时不需要同步多份副本。

## Requirements

### Requirement: 顶层目录按职责分区

Vela 顶层目录 SHALL 只承担四类职责之一：平台私有（`macos/`、`ios/`）、两端共享（`shared/`）、跨平台核心（`core/`）、仓库工具（`scripts/`、`docs/`）。每个平台私有目录 SHALL 同时包含该平台的界面、原生宿主与打包输入。

#### Scenario: 查找平台私有的全部实现

- **GIVEN** 需要修改 iOS 的界面行为
- **WHEN** 开发者浏览项目顶层目录
- **THEN** 该平台全部私有实现 SHALL 位于 `ios/` 之下，无需跨顶层目录查找

#### Scenario: 新增第三个平台

- **GIVEN** 未来需要支持新的平台
- **WHEN** 新增平台实现
- **THEN** SHALL 只需新增一个平台顶层目录，`shared/` 与 `core/` 不按平台拆分

#### Scenario: 定位打包输入

- **GIVEN** macOS 与 iOS 的打包方式不同
- **WHEN** 开发者查找应用元数据与图标
- **THEN** 两个平台的打包输入 SHALL 都位于各自平台目录的 `app` 子目录

### Requirement: 共享层不得依赖平台

`shared/` 与 `core/` SHALL NOT 引用 `macos/` 或 `ios/` 中的代码，两个平台目录 SHALL NOT 互相引用。任何被两个平台同时使用的能力 SHALL 位于 `shared/` 或 `core/`。

#### Scenario: 共享模块引入平台依赖

- **GIVEN** 共享模块需要一段平台特定行为
- **WHEN** 提交的变更让 `shared/` 引用 `macos/` 或 `ios/`
- **THEN** 结构测试 MUST 失败并指出违规引用

#### Scenario: 平台之间互相引用

- **GIVEN** macOS 与 iOS 需要相同能力
- **WHEN** 该能力的实现被放进另一个平台目录
- **THEN** 结构测试 MUST 失败

#### Scenario: 共享内容准入

- **GIVEN** 一段逻辑只被一个平台使用
- **WHEN** 它被提议放入 `shared/`
- **THEN** 评审 MUST 拒绝，或该平台保留独立实现

### Requirement: 单一 Core 实现

两个平台 SHALL 共用同一套读侧 Core 与控制协议实现。平台差异 SHALL 只能通过构造参数或平台编排层表达，MUST NOT 通过复制处理逻辑表达。

#### Scenario: 新增控制命令

- **GIVEN** 控制协议需要新增一条命令
- **WHEN** 实现该命令
- **THEN** 读侧处理 SHALL 只存在一处，两个平台入口复用同一实现

#### Scenario: iOS 能力边界

- **GIVEN** iOS 不发布本地服务、不探测本地目标
- **WHEN** 构建 iOS Core
- **THEN** 依赖检查 MUST 确认未引入发布、共享与本地探测能力

#### Scenario: 平台策略差异

- **GIVEN** 两个平台的映射重试次数不同
- **WHEN** 合并为同一实现
- **THEN** 差异 SHALL 由参数表达，两个平台的既有行为不变

### Requirement: 共享界面层单一实现

两个平台的界面 SHALL 共用控制请求的构造、响应解析、错误归一化与纯投影，MUST NOT 各自复制这些逻辑。

#### Scenario: 发送控制请求

- **GIVEN** 两个平台都通过宿主桥接访问 Core
- **WHEN** 发起一次控制请求
- **THEN** 请求构造、响应解析与错误归一化 SHALL 只有一份实现

#### Scenario: 渲染同一份载荷

- **GIVEN** 同一份 Core 载荷需要展示
- **WHEN** 两端分别渲染
- **THEN** 共享投影 SHALL 产出相同的标签、状态映射与命令文本

#### Scenario: 类型来源

- **GIVEN** 共享投影使用 TypeScript 编写
- **WHEN** 构建任一平台
- **THEN** 类型 SHALL 由源码本身提供，MUST NOT 依赖与实现重复的手写声明

### Requirement: 配置与设计 token 单一真源

跨平台共享的品牌色 SHALL 只有一个定义处，平台专属调色板 MAY 独立存在，但其共享部分 MUST 与真源一致。打包元数据 SHALL 是受版本控制的文件，MUST NOT 内联在构建脚本中。

#### Scenario: 调整品牌色

- **GIVEN** 需要修改强调色或状态色
- **WHEN** 开发者调整共享色值
- **THEN** SHALL 只需修改一处真源，两端调色板由自动校验保持同步

#### Scenario: 色值漂移

- **GIVEN** 某一端手工改动了共享色值
- **WHEN** 运行校验
- **THEN** 校验 MUST 失败并指出不一致的键

#### Scenario: 打包元数据

- **GIVEN** macOS 与 iOS 都需要应用标识、版本与图标声明
- **WHEN** 查看打包输入
- **THEN** 元数据 SHALL 以文件形式存在并可评审

### Requirement: 唯一验证入口

Vela SHALL 提供一个聚合验证命令，覆盖两个平台的语言检查、测试、构建产物与签名；发布门 MUST 包含 macOS 与 iOS 两侧的检查。

#### Scenario: 本地全量验证

- **GIVEN** 开发者完成一次改动
- **WHEN** 运行聚合验证命令
- **THEN** 系统 SHALL 依次执行两端检查，并在任一检查失败时返回非零退出码

#### Scenario: 发布门完整性

- **GIVEN** 一次改动只破坏 iOS 构建
- **WHEN** 运行发布门
- **THEN** 发布门 MUST 失败

#### Scenario: 本地与 CI 一致

- **GIVEN** 本地与 CI 各自执行检查
- **WHEN** 比较两者的检查列表
- **THEN** 发布门 SHALL 复用同一聚合命令，MUST NOT 维护两套清单

### Requirement: 入口文档与结构一致

Vela 根目录 SHALL 包含入口文档，说明产品定位、四类目录职责、构建与验证命令以及文档索引；文档中的路径与命令 MUST 与仓库实际一致。

#### Scenario: 新成员定位

- **GIVEN** 开发者首次进入 Vela
- **WHEN** 阅读入口文档
- **THEN** 文档 SHALL 给出目录职责、构建命令与文档索引

#### Scenario: 路径过期

- **GIVEN** 目录或脚本被重命名
- **WHEN** 运行文档校验
- **THEN** 校验 MUST 报告过期的路径引用
