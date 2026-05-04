## ADDED Requirements

### Requirement: TagBadge 使用暖色中性配色方案

TagBadge 组件 SHALL 使用暖色中性色调配色方案，替代当前的高饱和度彩色配色。配色方案 SHALL 与 docs-app 的 Claude 风格 off-white 主题协调。

#### Scenario: 标签颜色为暖色中性色调

- **WHEN** 渲染任意标签
- **THEN** 标签背景色 SHALL 为暖色中性色调（stone、warm gray 系列或其衍生色）
- **AND** 标签文本色 SHALL 为深暖色调以确保可读性
- **AND** hover 状态 SHALL 使用同色系的更深色调

#### Scenario: 不同标签具有视觉区分度

- **WHEN** 渲染多个不同名称的标签
- **THEN** 不同标签 SHALL 通过颜色哈希分配获得不同的颜色变体
- **AND** 颜色变体 SHALL 保持暖色中性色调的整体风格统一

### Requirement: 保持标签颜色自动分配逻辑

TagBadge SHALL 保持基于标签名称的自动颜色分配逻辑，确保同一标签名称在不同页面显示时颜色一致。

#### Scenario: 相同标签名称颜色一致

- **WHEN** 标签名称为 "linux"
- **THEN** 在首页、标签页、文档页 SHALL 显示相同的颜色
- **AND** 颜色分配 SHALL 基于名称哈希而非随机

#### Scenario: 标签颜色分配基于哈希

- **WHEN** 计算标签颜色
- **THEN** SHALL 使用标签名称字符码累加哈希
- **AND** SHALL 对颜色数组长度取模确定最终颜色索引