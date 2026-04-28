## Why

当前 docs-app 使用 Lime 主题配色（#84cc16 绿色系），缺乏视觉层次感。参考 Claude 站点的配色风格，重新设计配色方案，实现更清晰的内容分割和更专业的视觉效果。

## What Changes

1. **配色方案全面调整**
   - Body 背景使用米白色（#faf9f1）
   - Header/Footer 保持米白色背景
   - Header/Footer 使用深色下/上边框分割
   - 内容卡片使用纯白背景 + 深灰边框
   - 文字统一使用深灰色（#141413）
   - 完全去除彩色强调，只保留黑白灰

2. **调整范围**
   - Header 导航栏（米白背景 + 深色边框）
   - Footer 页脚（米白背景 + 深色边框）
   - 文档列表页（首页）
   - 文档详情页
   - 边框、分割线等装饰元素

3. **预期效果**
   - 米白色整体背景营造温暖的中性色调
   - 深色边框形成清晰的分割线
   - 白色内容卡片突出内容层次
   - 链接 hover 时显示下划线
   - 不需要亮色/暗色切换功能

## Capabilities

### New Capabilities

- `docs-app-color-redesign`: 新的配色方案（参考 Claude 黑白灰），包含 CSS 变量定义、组件样式调整

## Impact

- 修改 `packages/apps/docs-app/app/app.css` 中的 CSS 变量
- 修改 `packages/apps/docs-app/app/components/header.tsx`
- 修改 `packages/apps/docs-app/app/components/footer.tsx`
- 可能需要调整 `article-card.tsx` 和 `docs.$slug.tsx` 中的颜色相关样式

## Rollback Plan

如需回滚，保留当前配色的 CSS 变量备份，恢复以下值：

```css
--color-primary: #84cc16;
--color-primary-hover: #65a30d;
--color-text: #171717;
--color-text-muted: #737373;
--color-bg: #ffffff;
--color-border: #d9f99d;
```
