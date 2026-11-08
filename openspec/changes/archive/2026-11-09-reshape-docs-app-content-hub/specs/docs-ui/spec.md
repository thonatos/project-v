# Spec Delta

## ADDED Requirements

### Requirement: 内容模式可辨识

系统 SHALL 通过结构、标题和信息密度区分 Docs、Blog 与 Projects，同时保持统一品牌、导航、排版和焦点样式。

#### Scenario: 浏览不同分区
- **GIVEN** 用户依次访问 Docs、Blog 和 Projects
- **WHEN** 用户查看各分区页面
- **THEN** Docs SHALL 突出目录与查找
- **THEN** Blog SHALL 突出栏目与时间顺序
- **THEN** Projects SHALL 突出项目定位与行动入口

### Requirement: 克制的视觉层级

页面 SHALL 使用排版、留白和分隔线建立主要层级，不将玻璃效果、辉光、随机标签色或 WebGL 场景作为理解内容的前提。

#### Scenario: 无图形加速浏览站点
- **GIVEN** 用户设备不支持 WebGL 或禁用客户端脚本增强
- **WHEN** 用户访问首页、Docs、Blog 或 Projects
- **THEN** 全部主要内容、导航和操作 SHALL 保持可见且可用

#### Scenario: 区分交互元素
- **GIVEN** 页面包含链接、当前导航和栏目筛选
- **WHEN** 用户使用视觉或键盘方式浏览
- **THEN** 交互状态 SHALL 通过文字、线条、形状或焦点标记表达，不只依赖颜色

## MODIFIED Requirements

### Requirement: 站点标题配置

系统 SHALL 将品牌显示为 "ρV" 与 "undefined project."，将站点描述表达为用于沉淀知识、分享思考与呈现项目的公开站点，并为品牌名添加防翻译标记。

#### Scenario: 显示站点标题
- **GIVEN** 用户查看站点 Header
- **WHEN** 页面渲染
- **THEN** 导航栏 Logo 显示 "ρV" 与 "undefined project."
- **THEN** 品牌名被 `translate="no"` 包裹

#### Scenario: 页面 meta 标题
- **GIVEN** 用户打开站点页面
- **WHEN** 页面完成渲染
- **THEN** 浏览器标签页显示 "ρV" 或包含当前分区、内容或项目名称的标题

#### Scenario: 站点描述
- **GIVEN** 搜索引擎或用户查看站点 meta 信息
- **WHEN** 读取页面描述
- **THEN** 描述 SHALL 准确说明站点用于沉淀知识、分享思考与呈现项目
