# Spec Delta

## ADDED Requirements

### Requirement: 响应式状态具有单一写入边界

Vela 的领域状态与跨页面状态 SHALL 由所属 store 独占写入；页面和展示组件 MUST 通过只读访问器读取状态，并通过具名语义命令请求变更。仅服务于单个组件生命周期的临时状态 SHALL 由该组件持有，不得作为模块级或全局可写状态。

#### Scenario: 页面修改筛选条件

- **GIVEN** 日志页面需要切换当前级别
- **WHEN** 用户选择新的日志级别
- **THEN** 页面 SHALL 调用日志筛选命令，MUST NOT 直接写入 store 的底层 signal

#### Scenario: 组件临时状态被释放

- **GIVEN** 菜单开关或元素引用只服务于一个组件实例
- **WHEN** 该组件从界面移除
- **THEN** 临时状态、引用及其订阅 SHALL 随组件一起释放，MUST NOT 保留为模块级活动状态

### Requirement: 关联状态更新保持原子一致

一次用户意图或异步结果涉及多个关联状态时，Vela MUST 将这些状态作为一个原子更新发布，使观察者不得读取到违反该操作不变量的中间组合。被多个消费者读取或需要排序、分组等非平凡计算的派生状态 SHALL 保持同步且每次源状态变化至多重新计算一次。

#### Scenario: 打开远端服务

- **GIVEN** 用户选择一个可访问服务
- **WHEN** Vela 进入连接阶段并重置页面状态
- **THEN** 连接阶段、浏览状态、页面错误、导航能力与浮层状态 SHALL 作为一个一致快照对界面可见

#### Scenario: 读取共享派生集合

- **GIVEN** 多个界面区域读取经过排序或分组的设备与服务集合
- **WHEN** 源设备列表没有变化
- **THEN** 各区域 SHALL 得到同一派生结果，系统 MUST NOT 为每个读取者重复执行完整排序或分组

### Requirement: 异步状态遵守新鲜度与所有权

轮询、刷新、重试、计时器和订阅 MUST 具有明确生命周期，并在所有者释放时停止。可能重叠的异步状态请求 MUST 只允许最新有效请求更新界面；进行中、刷新中、失败与已有可用数据 SHALL 可区分，刷新期间 MUST NOT 无故丢弃仍可用的数据。

#### Scenario: 重叠刷新乱序完成

- **GIVEN** 两次设备刷新先后发出且后一次先完成
- **WHEN** 较早请求随后返回
- **THEN** 较早结果 MUST NOT 覆盖后一次结果，也 MUST NOT 提前结束后一次请求的刷新状态

#### Scenario: 页面离开时存在计时器

- **GIVEN** 页面拥有自动重试或延迟刷新计时器
- **WHEN** 页面被移除或所属流程被取消
- **THEN** 计时器 SHALL 被取消，之后 MUST NOT 再修改已释放页面的状态

### Requirement: 外部能力采用最小声明

两个 Vela UI 包 MUST 显式声明各自实际使用的 NSH 外部能力，且未使用的平台能力 MUST NOT 被授予。宿主原生模块与组件 SHALL 记录其信任边界；能力被拒绝时，应用 MUST 以与其他运行失败相同的方式提供可恢复反馈。

#### Scenario: 构建平台包

- **GIVEN** macOS 与 iOS 使用不同的剪贴板、外部 URL、WebView 或状态栏能力
- **WHEN** 构建任一平台 UI 包
- **THEN** 产物 SHALL 只包含该平台所需的能力声明，未知或缺失的声明 MUST 使验证失败

#### Scenario: 宿主拒绝已声明能力

- **GIVEN** 嵌入宿主授予的能力少于 Vela 声明的能力
- **WHEN** 用户触发被拒绝的操作
- **THEN** Vela SHALL 保持当前上下文并显示失败或恢复路径，MUST NOT 静默假定操作成功

### Requirement: 测试验证契约而非实现形态

Vela 的测试 MUST 验证可观察行为、运行结果或稳定静态边界，MUST NOT 通过源码正则锁定 JSX 层级、class 字符串、私有函数名、局部变量名、源码行数或可替换的实现步骤。UI 布局与原生交互 SHALL 通过 resolved bounds、目标平台行为或正式产品页面验证；通用 development host 与 fixture 的结果 MUST 明确其能力限制。

#### Scenario: 重构保持相同行为

- **GIVEN** 一次重构改变了组件嵌套、私有函数或 class 组合但保持所有公共行为
- **WHEN** 运行 Vela 测试
- **THEN** 测试 SHALL 继续通过，MUST NOT 因实现形态变化失败

#### Scenario: UI 布局异常

- **GIVEN** 同一控件在两个页面解析为不同宽度
- **WHEN** 验证修复结果
- **THEN** 测试 SHALL 比较目标平台的实际布局结果或产品页面证据，MUST NOT 要求两个页面复制相同 JSX

#### Scenario: 静态边界违规

- **GIVEN** feature 直接引用 native bridge、跨平台目录或可写 store signal
- **WHEN** 运行结构测试
- **THEN** 测试 MUST 失败并指出违规依赖；该源码扫描 MAY 保留，因为它验证稳定架构边界

## MODIFIED Requirements

### Requirement: 配置与设计 token 单一真源

跨平台共享的品牌色 SHALL 只有一个定义处，平台专属调色板 MAY 独立存在，但其共享部分 MUST 与真源一致。TSX、原生控件和宿主自定义主题 SHALL 通过语义角色取得颜色，MUST NOT 维护未受校验的颜色副本。打包元数据 SHALL 是受版本控制的文件，MUST NOT 内联在构建脚本中。

#### Scenario: 调整品牌色

- **GIVEN** 需要修改强调色或状态色
- **WHEN** 开发者调整共享色值
- **THEN** SHALL 只需修改一处真源，两端 TSX 与原生控件调色板由自动校验保持同步

#### Scenario: 色值漂移

- **GIVEN** 某一端或原生控件映射手工改动了共享色值
- **WHEN** 运行校验
- **THEN** 校验 MUST 失败并指出不一致的键

#### Scenario: 宿主提供自定义主题

- **GIVEN** Vela 在提供自定义语义主题的宿主中运行
- **WHEN** 主题或外观发生变化
- **THEN** TSX 元素与原生控件 SHALL 同步使用新的语义颜色，MUST NOT 保留启动时复制的旧颜色

#### Scenario: 打包元数据

- **GIVEN** macOS 与 iOS 都需要应用标识、版本与图标声明
- **WHEN** 查看打包输入
- **THEN** 元数据 SHALL 以文件形式存在并可评审

### Requirement: 唯一验证入口

Vela SHALL 提供一个聚合验证命令，覆盖两个平台的语言检查、测试、目标平台交互与可访问性验证、构建产物和签名；发布门 MUST 包含 macOS 与 iOS 两侧的检查。源码结构断言 MAY 保护分层约束，但 MUST NOT 代替对焦点、键盘、辅助状态、overlay、文字缩放、主题与几何结果的运行验证。

#### Scenario: 本地全量验证

- **GIVEN** 开发者完成一次改动
- **WHEN** 运行聚合验证命令
- **THEN** 系统 SHALL 依次执行两端检查，并在任一检查失败时返回非零退出码

#### Scenario: 发布门完整性

- **GIVEN** 一次改动只破坏 iOS 构建或目标平台交互
- **WHEN** 运行发布门
- **THEN** 发布门 MUST 失败

#### Scenario: 真实交互回归

- **GIVEN** 控件源码仍满足结构正则但已失去键盘焦点、辅助状态或 overlay 关闭行为
- **WHEN** 运行目标平台验证
- **THEN** 验证 MUST 失败并指出对应交互契约

#### Scenario: 本地与 CI 一致

- **GIVEN** 本地与 CI 各自执行检查
- **WHEN** 比较两者的检查列表
- **THEN** 发布门 SHALL 复用同一聚合命令，MUST NOT 维护两套清单

### Requirement: 入口文档与结构一致

Vela 根目录 SHALL 包含入口文档，说明产品定位、四类目录职责、构建与验证命令以及文档索引；文档中的路径、命令和 NSH 工具链版本 MUST 与仓库实际一致。

#### Scenario: 新成员定位

- **GIVEN** 开发者首次进入 Vela
- **WHEN** 阅读入口文档
- **THEN** 文档 SHALL 给出目录职责、构建命令与文档索引

#### Scenario: 路径过期

- **GIVEN** 目录、脚本或要求的 NSH 工具链版本被修改
- **WHEN** 运行文档校验
- **THEN** 校验 MUST 报告过期的路径、命令或版本提示
