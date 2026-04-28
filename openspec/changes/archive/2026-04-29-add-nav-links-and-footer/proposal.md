## Why

当前 docs-app 的导航栏缺少快捷访问外部链接的入口，用户无法快速跳转到项目首页或 GitHub 仓库。同时，Footer 区域未明确展示技术栈归属，缺乏技术品牌展示。这两个缺失影响了用户体验和项目可识别性。

## What Changes

- 在导航菜单栏添加 Home 链接（文字+图标）和 GitHub 链接（仅图标，无文字）
- 在 Footer 区域添加项目描述 "undefined project."
- 在 Footer 区域添加 "Powered By React Router" 标识，展示技术栈信息
- **BREAKING** 将 docs-app 主题风格从 slate 变为 neutral（影响全局配色）
- 保持现有导航和 Footer 结构不变，仅扩展内容

## Capabilities

### New Capabilities

- `nav-links`: 导航菜单栏新增 Home/GitHub 外部链接入口
- `footer-brand`: Footer 添加项目描述和技术栈品牌标识展示
- `theme-neutral`: 全局主题风格从 slate 变为 neutral

### Modified Capabilities

无（这是新增功能，不修改现有能力的需求定义）

## Impact

- **影响组件**: docs-app 的导航栏组件（可能是 header 或 navbar）和 Footer 组件
- **影响范围**: 主题变更影响全局配色（按钮、卡片、输入框、边框等所有使用 slate 色系的组件）
- **新增文件**: 可能需要新增外部链接图标组件或样式
- **依赖**: 无新增外部依赖，使用 React Router v7 现有能力
- **兼容性**: 主题变更属于视觉层面，不影响功能逻辑，但用户体验感知变化明显