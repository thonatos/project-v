# docs-motion-preference Specification

## Purpose
定义文档站点对 reduced-motion 偏好和触摸设备交互的适配要求，在保留可用反馈的同时减少不必要动画和操作阻碍。

## Requirements

### Requirement: Reduced Motion 支持

系统 SHALL 尊重 `prefers-reduced-motion`，禁用非必要过渡和 Vela 连接示意中的移动效果，同时保留所有信息、状态与操作。

#### Scenario: 用户偏好减少动画
- **GIVEN** 用户系统设置 `prefers-reduced-motion: reduce`
- **WHEN** 用户访问任意页面
- **THEN** 非必要 CSS transition 与移动动画 SHALL 被禁用
- **THEN** Vela 工作方式 SHALL 以静态连接示意完整呈现

#### Scenario: 用户无特殊偏好
- **GIVEN** 用户系统未设置减少动画
- **WHEN** 用户查看 Vela 连接示意或交互状态
- **THEN** 页面 MAY 使用一次集中的轻量动效辅助表达连接关系和状态变化

#### Scenario: Hover 状态保持
- **GIVEN** 用户偏好减少动画
- **WHEN** 用户 hover 或聚焦交互元素
- **THEN** 颜色、线条和焦点标记 SHALL 仍然生效，仅取消其过渡动画

### Requirement: 触摸优化
系统 SHALL 添加触摸交互优化，减少触摸延迟并防止意外行为。

#### Scenario: 触摸操作优化
- **WHEN** 用户在触摸设备上点击交互元素
- **THEN** 无双击缩放延迟（touch-action: manipulation）
