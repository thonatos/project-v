## Context

当前 docs-app 使用 Lime 主题配色（绿色系 #84cc16），存在以下问题：
- Header/Footer 与内容区域缺乏视觉对比
- 边框颜色过浅（#d9f99d），分割效果不明显
- 整体风格偏"年轻/活泼"，与专业文档站点风格不符

参考 Claude.com 产品站点的配色风格（通过 Playwright 提取）：
- Body 背景使用米白色（#faf9f1）
- Header/Footer 保持米白色背景
- Header/Footer 使用深色下/上边框分割（#141413）
- 内容卡片使用纯白背景 + 深灰边框（#30302e）
- 文字统一使用深灰色（#141413）
- 链接 hover 时显示下划线，无彩色强调

## Goals / Non-Goals

**Goals:**
- 采用 Claude 站点的米白色调整体背景
- 实现 Header/Footer 深色边框分割效果
- 提升文档列表和详情页的标题可读性
- 优化边框、分割线等辅助元素的颜色层级
- 保持整体配色的专业感和现代感

**Non-Goals:**
- 不实现亮色/暗色主题切换
- 不使用任何彩色强调（无 Indigo、蓝色等）
- 不修改字体、间距等非颜色相关的样式
- 不改变现有组件的结构和布局

## Decisions

### 决策 1: 配色方案采用 Claude 米白色调

**选择：**
```css
--color-bg: #faf9f1;             /* 米白色 Body 背景 */
--color-bg-subtle: #f5f5f3;      /* 稍深的米白用于 hover */
--color-bg-card: #ffffff;        /* 纯白卡片背景 */
--color-text: #141413;           /* 深灰用于正文 */
--color-text-muted: #6b6b6b;     /* 中灰用于辅助文字 */
--color-border: #30302e;         /* 深灰边框 */
--color-border-subtle: #e5e5e3;   /* 浅灰边框 */
--color-primary: #141413;        /* 深色用于主要文字 */
```

**理由：**
- 与 Claude 站点的米白色调完全一致
- 层次分明：米白 Body → 白色卡片 → 深灰边框
- 无彩色强调，视觉上更加专业和内敛

### 决策 2: Header/Footer 使用米白背景 + 深色边框

**选择：**
```css
header, footer {
  background-color: #faf9f1;    /* 米白色 */
  color: #141413;               /* 深灰文字 */
  border-color: #141413;         /* 深色边框 */
}
```

**理由：**
- 与 Claude 站点的风格完全一致
- 深色边框形成清晰的视觉分割
- 米白背景营造温暖的阅读氛围

### 决策 3: 标题和链接使用深灰色

**选择：**
```css
h1, h2, h3, a {
  color: #141413;  /* 深灰色 */
}

a:hover {
  text-decoration: underline;  /* hover 显示下划线 */
}
```

**理由：**
- 深灰色比纯黑更柔和，阅读体验更好
- hover 时显示下划线是 Claude 站点的标准交互方式
- 完全去除彩色，符合极简风格

## Risks / Trade-offs

| 风险 | 影响 | Mitigation |
|------|------|------------|
| 米白色背景可能与部分显示器色温不匹配 | 可能在某些屏幕上显得偏黄 | 米白色是 Claude 站点的标准色，可接受 |
| 纯黑白灰可能显得过于单调 | 视觉上缺乏活力 | 通过层次对比（米白 vs 白色卡片 vs 深灰边框）保持视觉兴趣 |

## Open Questions

无
