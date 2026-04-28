## ADDED Requirements

### Requirement: 全局主题风格变更为 neutral

系统必须将全局配色从 slate 色系变更为 neutral 色系，确保视觉风格一致性。

#### Scenario: Slate 色系类名替换为 Neutral

- **WHEN** 系统渲染使用 slate 色系的组件
- **THEN** 所有 `slate-*` Tailwind CSS 类名已替换为对应 `neutral-*` 类名

#### Scenario: CSS 变量更新为 Neutral 色值

- **WHEN** shadcn/ui CSS 变量定义颜色
- **THEN** 基础色变量（如 `--primary`, `--secondary`, `--background`）使用 neutral 色板值

### Requirement: 主题变更保持视觉一致性

系统必须确保主题变更后，所有组件视觉效果保持一致，无颜色断层或冲突。

#### Scenario: 按钮组件配色一致

- **WHEN** 用户查看按钮组件
- **THEN** 按钮背景、边框、文字颜色均使用 neutral 色系，视觉协调

#### Scenario: 卡片组件配色一致

- **WHEN** 用户查看卡片组件
- **THEN** 卡片背景、边框、阴影颜色均使用 neutral 色系，视觉协调

#### Scenario: 输入框组件配色一致

- **WHEN** 用户查看输入框组件
- **THEN** 输入框背景、边框、焦点状态颜色均使用 neutral 色系，视觉协调