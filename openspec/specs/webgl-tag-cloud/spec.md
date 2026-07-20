# webgl-tag-cloud Specification

## Purpose
TBD - created by archiving change docs-app-visual-revamp. Update Purpose after archive.
## Requirements
### Requirement: 真 3D 标签球
系统 SHALL 在标签页以 WebGL（@react-three/fiber）渲染真正的三维标签球：标签按球面均匀分布，标签文字始终朝向相机，并按文章计数映射字号/辉光强度。

#### Scenario: 三维分布
- **WHEN** 标签页 3D 就绪
- **THEN** 所有标签以球面分布呈现，高频标签字号更大、辉光更强

#### Scenario: 辉光效果
- **WHEN** 渲染 3D 标签球
- **THEN** 通过后处理 Bloom 呈现辉光以体现现代技术质感

### Requirement: 标签球交互
系统 SHALL 支持标签球的惯性拖拽旋转、自动慢速旋转、hover 高亮与点击导航到对应标签页。

#### Scenario: 拖拽旋转
- **WHEN** 用户拖拽标签球
- **THEN** 球体随拖拽旋转并带惯性衰减

#### Scenario: 悬停高亮
- **WHEN** 用户悬停某标签
- **THEN** 该标签高亮突出于其他标签

#### Scenario: 点击导航
- **WHEN** 用户点击某标签
- **THEN** 路由跳转至该标签的详情页 `/tags/<tag>`

### Requirement: 标签云 client-only 与降级
系统 SHALL 将 3D 标签云作为 client-only 懒加载模块，SSR 输出语义化标签链接列表作为降级；在无 WebGL 或 `prefers-reduced-motion` 时回落到 2D 标签展示。

#### Scenario: SSR 语义降级
- **WHEN** 页面在服务端渲染或客户端脚本未执行
- **THEN** 输出可点击的 `<a href="/tags/...">` 标签列表供用户与爬虫使用

#### Scenario: 无 WebGL 回落
- **WHEN** 浏览器不支持 WebGL 或用户开启 reduced-motion
- **THEN** 展示 2D 标签云而非 3D，且不加载 three 相关 chunk

#### Scenario: 不阻塞首屏 bundle
- **WHEN** 构建产物生成
- **THEN** three/R3F 位于独立 chunk，不进入首屏入口 bundle

