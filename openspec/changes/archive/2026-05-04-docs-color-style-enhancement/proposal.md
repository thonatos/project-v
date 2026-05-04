## Why

docs-app 当前使用 Claude 风格的 off-white 暖色调配色，整体视觉偏冷、不够活泼。参考 Longbridge Developers 文档站的明亮现代风格，需要优化色彩方案使其更加鲜艳明亮、简约简洁，同时完善导航功能以提升用户体验。

## What Changes

- **主题配色调整**：从 off-white 暖色调改为青绿色系，配合白色背景
- **背景渐变色**：添加从白色到浅青绿色的微妙渐变，提升美观性
- **导航栏重构**：采用左右分栏布局，左侧 logo，右侧链接用竖线分割（便于扩展）
- **导航链接增强**：增加 Tags、Tech、Trading 页面导航链接，保持 GitHub 图标
- **层次感设计**：在文档标题区域使用线框/card 增加层次感（克制、小范围使用）
- **标题样式优化**：增加青绿色装饰（下划线、左边框）
- **Tag Badge 重构**：采用青绿色系配色，统一共享配置
- **超链接样式**：青绿色高亮，提升可点击识别度
- **文档语言**：以中文为主要语言
- **回滚计划**：保留原 CSS 变量定义注释，可快速切换回原配色

## Capabilities

### New Capabilities

- `theme-colors`: 新的主题配色系统，包含青绿色系定义、标题样式、链接样式、代码块样式
- `navigation-links`: 增强的导航栏功能，包含 Tags、Tech、Trading、GitHub 链接

### Modified Capabilities

- `tag-badge-colors`: 修改 tag-badge 组件的配色方案，从暖色中性色调改为青绿色系

## Impact

- **代码影响**：
  - `app/app.css` - 主要样式变更（CSS 变量、prose 样式、标题装饰、链接样式）
  - `app/components/header.tsx` - 导航栏增强（新增导航链接）
  - `app/components/tag-badge.tsx` - 配色调整（青绿色系）
  - `app/components/article-card.tsx` - 需检查 CSS 变量使用是否需要调整
  - `app/components/footer.tsx` - 需检查 CSS 变量使用是否需要调整
  - `app/components/toc.tsx` - 需检查 CSS 变量使用是否需要调整
  - `app/routes/tags._index.tsx` - **需要修改**：删除重复的 TAG_COLORS 定义，改用共享配置
  - `app/routes/_index.tsx` - 需检查 CSS 变量使用
  - `app/routes/docs.$slug.tsx` - 需检查 CSS 变量使用
  - `app/routes/tags.$tag.tsx` - 需检查 CSS 变量使用
  - `app/routes.ts` - 新增 `/tech` 和 `/trading` 路由
  - 新增路由文件：`app/routes/tech._index.tsx`、`app/routes/trading._index.tsx`

- **重复代码问题**：
  - `TAG_COLORS` 在 `tag-badge.tsx` 和 `tags._index.tsx` 中重复定义，需要统一

- **视觉影响**：整体文档站视觉风格变化，从暖色调转为清新青绿配色

- **用户体验**：导航更清晰、标签更醒目、阅读体验更现代