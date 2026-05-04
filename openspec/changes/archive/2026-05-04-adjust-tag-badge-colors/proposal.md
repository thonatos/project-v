## Why

当前 TagBadge 组件使用高饱和度的彩色配色（amber、cyan、rose、emerald、violet），与 docs-app 采用的 Claude 风格暖色中性色调（off-white/beige 背景 `#f0f0eb`）视觉上不协调。彩色标签在暖灰色背景上显得过于突兀，破坏了整体设计的统一性和专业感。

## What Changes

- 调整 TagBadge 的配色方案，使用与 docs-app 主题协调的暖色中性色调
- 保持标签的可辨识度，但降低饱和度，使其融入整体设计
- 保持基于标签名称的自动颜色分配逻辑不变

## Capabilities

### New Capabilities

- `tag-badge-colors`: 定义新的标签配色方案，使用暖色中性色调替代当前的高饱和度彩色

### Modified Capabilities

无现有 specs 需修改，这是纯视觉层面的实现变更。

## Impact

- `packages/apps/docs-app/app/components/tag-badge.tsx` - 更新 TAG_COLORS 配置
- 所有使用 TagBadge 的页面（首页文章卡片、标签页、文档页）将呈现新的视觉效果