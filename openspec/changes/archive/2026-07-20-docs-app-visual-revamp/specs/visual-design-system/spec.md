## ADDED Requirements

### Requirement: 分层深色主题
系统 SHALL 采用 dark-first 分层深色配色，通过多级表面色（bg-base、surface-1、surface-2、glass）营造纵深，并提供 violet→fuchsia 主色渐变作为全站品牌色。

#### Scenario: 全站默认深色
- **WHEN** 用户访问站点任意页面
- **THEN** 页面 body 背景为深色 bg-base，文字为高对比浅色，卡片使用分层表面色

#### Scenario: 主色渐变可复用
- **WHEN** 组件需要品牌强调（hero 文字、按钮、辉光）
- **THEN** 系统提供 violet→fuchsia 渐变 token 供其引用

### Requirement: 玻璃拟态卡片
系统 SHALL 以玻璃拟态/分层表面替代原白底+边框卡片，提供柔和阴影与主色辉光两类阴影 token。

#### Scenario: 卡片视觉层次
- **WHEN** 列表页渲染文章/分类卡片
- **THEN** 卡片使用分层表面色填充与柔和阴影，而非纯描边

#### Scenario: 悬停反馈
- **WHEN** 用户悬停可交互卡片
- **THEN** 卡片表面提升一档并呈现主色辉光过渡

### Requirement: 分类色彩编码
系统 SHALL 为每个文档分类稳定映射一种主题色（至少 6 色：violet/cyan/amber/emerald/rose/indigo），同一分类名始终得到同一颜色。

#### Scenario: 分类稳定着色
- **WHEN** 同一分类在不同页面出现
- **THEN** 该分类始终呈现相同的主题色（左边条/色块/标签色）

### Requirement: 统一动效与形状 token
系统 SHALL 统一圆角、阴影、辉光与动效缓动曲线，使不同页面风格差异下仍保持一致"手感"。

#### Scenario: 一致的交互过渡
- **WHEN** 任意可交互元素触发过渡
- **THEN** 其缓动曲线与时长遵循统一 token

#### Scenario: 尊重减少动效偏好
- **WHEN** 用户系统开启 `prefers-reduced-motion`
- **THEN** 动画时长与滚动行为被降级为近乎无动画
