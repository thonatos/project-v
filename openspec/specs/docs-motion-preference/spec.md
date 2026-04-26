## ADDED Requirements

### Requirement: Reduced Motion 支持
系统 SHALL 尊重用户的 `prefers-reduced-motion` 设置，为需要减少动画的用户禁用过渡效果。

#### Scenario: 用户偏好减少动画
- **WHEN** 用户系统设置 `prefers-reduced-motion: reduce`
- **THEN** 所有 CSS transition 效果被禁用（transition: none）

#### Scenario: 用户无特殊偏好
- **WHEN** 用户系统未设置 `prefers-reduced-motion: reduce`
- **THEN** 保持原有的 transition 效果

#### Scenario: Hover 状态保持
- **WHEN** 用户偏好减少动画
- **THEN** hover 状态的颜色变化仍然生效（仅禁用 transition 动画）

### Requirement: 触摸优化
系统 SHALL 添加触摸交互优化，减少触摸延迟并防止意外行为。

#### Scenario: 触摸操作优化
- **WHEN** 用户在触摸设备上点击交互元素
- **THEN** 无双击缩放延迟（touch-action: manipulation）