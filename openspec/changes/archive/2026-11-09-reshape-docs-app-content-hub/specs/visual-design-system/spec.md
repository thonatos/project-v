# Spec Delta

## MODIFIED Requirements

### Requirement: 分层深色主题
系统 SHALL 采用高对比 dark-first 配色，以克制的表面层级、文字和分隔线组织页面，并允许项目专页通过语义 token 覆盖自己的主题色。

#### Scenario: 全站默认深色
- **GIVEN** 用户访问站点任意页面
- **WHEN** 页面渲染
- **THEN** 页面 SHALL 使用深色背景、高对比文字和清晰分隔边界

#### Scenario: 主色渐变可复用
- **GIVEN** 项目具有自己的品牌色
- **WHEN** 用户访问项目专页
- **THEN** 页面 SHALL 在统一站点外壳中使用项目语义色而不改变导航结构

### Requirement: 统一动效与形状 token
系统 SHALL 使用有限的形状、颜色和动效 token 保持交互一致，并将动效限定为辅助表达状态或关系。

#### Scenario: 一致的交互过渡
- **GIVEN** 交互元素需要状态反馈
- **WHEN** hover、focus 或 active 状态发生
- **THEN** 反馈 SHALL 使用统一颜色、线条和过渡规则

#### Scenario: 尊重减少动效偏好
- **GIVEN** 用户系统开启 `prefers-reduced-motion`
- **WHEN** 页面包含非必要动画
- **THEN** 动画 SHALL 停止，同时保留内容与状态表达

## REMOVED Requirements

### Requirement: 玻璃拟态卡片

**Reason**: 新视觉体系以排版、留白和分隔线为主，不再要求统一玻璃卡片和辉光。

**Migration**: 各栏目使用与职责匹配的列表、索引和项目分区。

### Requirement: 分类色彩编码

**Reason**: 随机分类色会制造无实际语义的视觉噪声。

**Migration**: 分类通过名称、层级和统一语义色呈现。
