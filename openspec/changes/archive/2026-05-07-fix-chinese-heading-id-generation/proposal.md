## Why

docs-app 的 `generateHeadingId` 函数使用正则表达式 `/[^\w\s-]/g` 移除非字母数字字符，但 `\w` 仅匹配 `[a-zA-Z0-9_]`，导致中文字符被全部移除。中文标题如 "核心价格数据" 生成的 id 为空字符串，使得 TOC 无法正确高亮、hash 导航无法跳转。

## What Changes

- 修改 `generateHeadingId` 函数，支持中文字符保留或转换为拼音
- 为每个 heading 生成唯一、有效的 id，无论标题是中文、英文还是混合

## Capabilities

### New Capabilities

- `heading-id-generation`: 为任意语言（中文、英文、混合）的 heading 文本生成有效的、唯一的 id

### Modified Capabilities

（无已有 spec 需要修改）

## Impact

- 受影响文件：`packages/apps/docs-app/app/lib/docs.ts`（`generateHeadingId` 函数）
- 受影响功能：TOC 高亮、URL hash 导航、heading 链接锚点
- 无 API 变更、无依赖变更、无破坏性改动
- 回滚方案：恢复原 `generateHeadingId` 实现（`\w` 仅匹配英文）