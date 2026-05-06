## 1. 核心实现

- [x] 1.1 修改 `generateHeadingId` 函数：使用 Unicode 正则 `\p{L}\p{N}` 替代 `\w`，支持中文字符
- [x] 1.2 在 `addHeadingIds` 和 `extractToc` 中添加计数器 Map，为重复标题生成唯一 id（如 "注意事项-2"）

## 2. 验证

- [x] 2.1 访问中文文档页面（如 `intc-investment-analysis-2026-05-06`），确认 heading id 不为空（13/14 有效）
- [x] 2.2 确认 TOC 能正确高亮中文 heading（滚动后 "近期新闻" 高亮）
- [x] 2.3 通过 URL hash 导航到中文 heading，确认页面跳转正确（#利好因素 导航成功）
- [x] 2.4 确认英文标题格式保持不变（Installation Guide → Installation-Guide）