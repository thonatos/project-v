## ADDED Requirements

### Requirement: 中文标题生成有效 id

`generateHeadingId` 函数 SHALL 为中文标题生成有效的、非空的 id 字符串。

#### Scenario: 纯中文标题
- **WHEN** 输入文本为 "核心价格数据"
- **THEN** 输出 SHALL 为有效的 id（如 "核心价格数据" 或 "he-xin-jia-ge-shu-ju"），非空字符串

#### Scenario: 中英混合标题
- **WHEN** 输入文本为 "Analyst 分析报告"
- **THEN** 输出 SHALL 保留中英文字符，生成有效 id（如 "analyst-分析报告" 或混合格式）

#### Scenario: 空标题或纯符号标题
- **WHEN** 输入文本为空或仅包含非字母数字符号（如 "###"）
- **THEN** 输出 SHALL 为空字符串，不抛出异常

### Requirement: heading id 唯一性

同一文档内多个相同文本的 heading SHALL 生成不同的 id，避免重复。

#### Scenario: 多个相同标题
- **WHEN** 文档中有两个 "注意事项" heading
- **THEN** 第二个 heading 的 id SHALL 与第一个不同（如 "注意事项-2"）

### Requirement: id 格式合规

生成的 id SHALL 符合 HTML id 属性规范：仅包含字母、数字、下划线、连字符，且不以数字开头。

#### Scenario: id 格式验证
- **WHEN** 输入任意文本生成 id
- **THEN** id SHALL 仅包含 `[a-zA-Z0-9_-]` 字符，且不以数字开头（浏览器兼容性要求）