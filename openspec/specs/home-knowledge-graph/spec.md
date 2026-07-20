# home-knowledge-graph Specification

## Purpose
TBD - created by archiving change docs-app-visual-revamp. Update Purpose after archive.
## Requirements
### Requirement: 知识网络图谱
系统 SHALL 在首页以 WebGL 渲染一张知识网络图谱：将文章、标签、分类抽象为节点，标签共现与文章-标签关系抽象为边，文章节点按分类着色。

#### Scenario: 图谱语义
- **WHEN** 首页 3D 图谱就绪
- **THEN** 文章与标签以节点呈现，标签共现与文章-标签关系以边连接，文章节点按其分类着色

#### Scenario: 共现数据来源
- **WHEN** 首页 loader 执行
- **THEN** 在服务端基于 getAllDocs 计算标签共现矩阵并序列化传给客户端渲染

### Requirement: 滚动叙事
系统 SHALL 在首页实现滚动驱动的叙事：相机随滚动进度在图谱中穿行，Blog/Docs/Tags 分区随滚动依次淡入。

#### Scenario: 相机穿行
- **WHEN** 用户滚动首页
- **THEN** 相机位置/朝向按滚动进度插值穿行图谱

#### Scenario: 分区依次淡入
- **WHEN** 某分区进入视口
- **THEN** 该分区内容淡入呈现

#### Scenario: 尊重减少动效
- **WHEN** 用户开启 `prefers-reduced-motion`
- **THEN** 停用相机动画与淡入，静态展示图谱与分区

### Requirement: 首页 client-only 与降级
系统 SHALL 将首页 WebGL 图谱作为 client-only 懒加载背景增强层，SSR 始终输出 hero 文字与分区入口的静态可用 DOM；无 WebGL 时不加载 three 相关 chunk。

#### Scenario: SSR 静态可用
- **WHEN** 页面在服务端渲染或脚本未执行
- **THEN** hero 文字与 Blog/Docs/Tags 入口以静态 DOM 呈现且可点击

#### Scenario: 无 WebGL 回落
- **WHEN** 浏览器不支持 WebGL
- **THEN** 展示静态首页而不加载 three 相关 chunk

