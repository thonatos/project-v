# Design

## Context

见 `proposal.md` 的 Why。docs-app 当前是 React Router Framework Mode 的静态站点，`ssr: false`，loader 在构建期读取 `app/docs/*.md` 并预渲染到 `build/client`。所有正文共用 `/docs/:slug`，Blog 与 Docs 仅靠 frontmatter `type` 区分；Tags 同时驱动标签页、文章链接、首页知识图谱和 Three.js 依赖。

项目约束要求公开文章继续放在 `app/docs/`，站点数据由 loader 提供，不引入客户端状态库。功能测试和人工 review 使用持续运行的 dev server 与 HMR；最终验收再执行构建、类型检查和静态产物检查。本次不执行 Cloudflare 部署。

React Router v8.5.1 要求 Node 22.22+、React/React DOM 19.2.7+ 和 Framework Mode 下的 Vite 7+。仓库基线为 Node 24.11+，CI 使用 Node 24，本地为 Node 24.22，Node 无需调整；docs-app 需要同步升级 React Router 系列、React 与 Vite。当前 `@cloudflare/vite-plugin` 1.34.0、Tailwind Vite 插件和路径插件声明支持 Vite 7。

## Goals / Non-Goals

**Goals:**

- 让统一站点外壳清楚承载 Docs、Blog、Projects 三种不同阅读任务。
- 保留现有 Markdown 管线与单一内容目录，同时让内容类型决定规范 URL 和页面布局。
- 让旧 Blog 与 Tags URL 在纯静态预览和托管环境中具有可用迁移结果。
- 将 docs-app 升级到同一 React Router v8.5 系列，并证明 SSG、直接访问和本地 dev server 正常。
- 在实现期间保持 dev server 运行，提供本地地址和明确的 review 清单。

**Non-Goals:**

- 不修改 Vela 应用代码、版本、发布流程或二进制。
- 不把 Vela 的仓库工程文档自动发布为站点内容。
- 不建立 CMS、搜索、评论、账户、服务端 API 或客户端状态层。
- 不升级 react-app、i18n-studio 等其他 React Router 应用。
- 不执行 Cloudflare 部署，也不新增自动部署 gate。
- 不在第一版虚构产品截图、iOS App Store 或 TestFlight 下载入口。

## Decisions

### 1. 继续使用一个 Markdown 内容目录，以类型派生规范 URL

`app/docs/*.md` 仍是 Docs 与 Blog 的唯一公开正文来源。`type: docs | blog` 决定内容归属和规范地址：Docs 使用 `/docs/:slug`，Blog 使用 `/blog/:slug`。在内容读取层提供统一的 `href` 派生，首页、列表、目录和相关文章链接不得各自拼接路径。

Blog 的 `category` 只接受两个稳定值，建议使用机器值 `engineering` 与 `markets`，界面映射为“技术与工程”“股票与市场”。Docs 的 `category` 继续使用自由文本目录名。所有既有 Blog 在迁移时补齐栏目；`building-vela-with-nsh.md` 改为 Blog / engineering，股票分析改为 Blog / markets。

选择此方案而不是新增平行内容目录，是为了遵守包级边界并复用现有 Markdown、TOC、代码高亮和 Mermaid 管线。选择显式且受限的 Blog 栏目，而不是继续从 tags 推断，是为了让导航结果稳定且可验证。

### 2. Projects 使用注册表与独立路由，不进入 Markdown type

项目索引所需的名称、摘要、状态、平台和路由由轻量项目注册表提供。`/projects/vela` 使用独立 route module 和展示组件，读取注册表基础数据，并在页面中维护 Vela 特有内容与构图。

项目页复用 Header、Footer、容器、焦点和响应式规则；页面外壳覆盖局部品牌 token，使 Header、正文与 Footer 连续。Vela 使用现有双帆 SVG 的站点副本及项目共享 token 中的暖棕色，不从 `packages/apps/vela/**` 运行时导入资产，避免两个应用产生构建依赖。

选择独立 route module 而不是通用 Markdown 项目模板，是因为未来项目可能需要不同的信息结构；注册表仍可保证 `/projects` 的一致索引。第一版不建立动态 `/projects/:slug` 内容系统，避免在只有一个项目时过度抽象。

### 3. UI 采用统一外壳和三种内容模式

全站保留深色基调与 `ρV undefined project.` 品牌，但减少紫色辉光、玻璃卡片和装饰性动画。基础层级由排版、留白和分隔线建立：

- Canvas `#111216`
- Surface `#191a1f`
- Text `#f0efea`
- Muted `#9b9ca4`
- Rule `#303139`
- Brand/Focus `#9b87ff`

Vela 正文局部使用项目 token：深色 canvas `#1b1a18`、主文字 `#f2f0ec`、accent `#e08a5e`。全局焦点保持高对比并可见。

布局关系：

```text
                         Shared shell
                              |
            +-----------------+-----------------+
            |                 |                 |
          Docs              Blog             Projects
      compact index     editorial stream    branded profile
      category + TOC    category + date     purpose + action
```

Header 桌面端一行展示品牌、Docs、Blog、Projects 与 GitHub，当前分区使用下划线、字重和 `aria-current`。移动端分成品牌操作行与三入口导航行，避免压缩链接。

首页取消全屏图谱舞台，首屏直接给出定位和三类入口；精选 Vela 占据主要视觉区域，Blog 使用带栏目和日期的时间流，Docs 使用紧凑分类清单。Docs 列表不再使用杂志卡片；Blog 列表不再包在单个玻璃容器；Projects 列表显示状态、平台和明确行动。

Vela 页的唯一重点动效是 Mac 到 iPhone 的连接路径；静态线条和文字本身完整表达流程，动画只作增强。这样视觉特征来自“航线与双帆”，而不是可替换到任何产品页的渐变卡片。

选择此方向而不是延续统一卡片模板，是为了让页面结构编码真实内容职责；选择轻量 CSS/SVG 而不是 Three.js，是为了降低客户端成本并保证无 WebGL 时完整可用。

### 4. Tags 下线但 frontmatter 暂时兼容

Header、首页、列表、正文不再提供 Tags 入口，删除标签球、标签详情展示、随机标签色与知识图谱。`tags` 仍由 frontmatter 解析并保留在内容对象中，但不作为公开导航；这避免为了 UI 下线而无价值地重写全部内容，也给未来搜索保留原始元数据。

Three.js、React Three Fiber、Drei 与 postprocessing 在确认无剩余引用后从 docs-app 依赖移除。与 WebGL 展示专用的组件和 hook 同步删除。Mermaid 使用独立依赖，不受影响。

### 5. 旧 URL 使用静态迁移页，不依赖平台重定向

`/docs/:slug` loader 读取内容：Docs 正常渲染；Blog 渲染一个可预渲染迁移页，页面包含规范链接，并在 hydration 后使用 replace 导航到 `/blog/:slug`。`/tags` 和构建时已知的 `/tags/:tag` 同样生成迁移页并 replace 到 `/blog`。迁移页提供明确文字和链接，即使 JavaScript 未执行也不会成为死页。

```text
old URL request
     |
     v
pre-rendered migration page ---- JS unavailable ----> visible canonical link
     |
     +---- hydration ---- replace history ----> canonical route
```

已知历史标签路径继续从现有 frontmatter 生成，但只用于构建兼容页，不向 UI 暴露标签聚合。Cloudflare 的 SPA fallback 继续兜底未知旧标签地址；本次不依赖或修改 Cloudflare redirect 配置，因此本地生产预览能验证同一行为。

选择迁移页而不是 loader HTTP redirect，是因为纯静态输出没有运行时 loader，构建期 redirect 对不同静态服务器的落盘和状态码行为不稳定。选择 replace 而不是 push，避免浏览器返回按钮回到迁移页后再次跳转。

### 6. React Router v8 采用单包、同版本系列升级

docs-app 的 `react-router`、`@react-router/dev`、`@react-router/node`、`@react-router/serve`、`@react-router/fs-routes` 固定在同一 v8.5.x 版本，避免其精确 peer 关系出现混用；React 与 React DOM 至少升级到 19.2.7，Vite 升到 7.x。只修改 docs-app manifest 和根 lockfile。

升级前先将 v7 用法对齐 v8：route meta 参数从已废弃的 `data` 改为 `loaderData`；检查 DOM 专用 API import；启用或直接采用 v8 默认的 Framework Mode 行为。实现验证发现 `@cloudflare/vite-plugin` 会在纯 SSG 构建中拦截 React Router v8 的根数据预渲染请求 `/_.data` 并返回 404，因此从 Vite 构建链移除该插件；部署仍由 Wrangler 按 `wrangler.jsonc` 直接发布 `build/client` 静态资产，不改变目标或命令。

由于 WebGL 依赖同步删除，Vite 的 React/Three dedupe 与 optimizeDeps 配置也应收敛，只保留真实需要的配置。构建必须继续保持 `ssr: false` 和完整 prerender 路径。

React Router v8 仍只在 docs-app 升级。由于仓库通用 override 原先将所有 `react@^19.0.0` 固定到 19.2.5，而 React Router v8 要求 React 19.2.7+，经维护者确认将全 workspace 的 React/React DOM patch override 统一到 19.2.7；其他应用不升级路由或功能，只执行各自既有聚合门验证 patch 兼容性。

## Risks / Trade-offs

- [React Router v8、Vite 7 与 Cloudflare 插件组合可能暴露构建差异] → 固定同一 v8.5 系列，先执行 typegen/typecheck，再执行完整 SSG 构建并检查全部产物；失败时先隔离框架升级原因，不用 UI 特例绕过。
- [根 lockfile 更新可能重新解析其他 workspace 依赖] → 使用 docs-app 定向依赖更新，审查 lockfile diff，确认其他包 manifest 未变；CI 仍运行全 workspace Node 门。
- [静态迁移页不能返回永久 HTTP 301] → 页面提供 canonical URL、无脚本后备链接和客户端 replace；真正需要搜索引擎级 301 时另开部署配置 change，本次不假装静态页等价于 301。
- [Blog 栏目只有两个值，未来内容可能不适配] → 将映射集中定义，未来以内容需求新增稳定栏目，不恢复高基数标签导航。
- [Vela 下载链接可能指向 latest release 而版本状态变化] → 使用 GitHub Releases 稳定入口，不在页面硬编码未经验证的版本号或 iOS 分发承诺。
- [删除 WebGL 后首页失去现有视觉记忆] → 以首页三栏结构和 Vela 航线作为新的单一标志性元素，review 时重点比较信息清晰度和品牌辨识度。
- [移动端双层 Header 增加垂直占用] → 控制两行总高度并在真实窄视口检查正文锚点、sticky 偏移和抽屉触发位置。

## Migration Plan

1. 对齐 React Router v8 前置用法并升级 docs-app 框架依赖，保持现有页面可构建。
2. 扩展内容模型、补齐 Blog 栏目和规范 URL 派生；增加新的 Blog 正文 route。
3. 建立统一外壳和三种内容展示组件，重做 Header、首页、Docs 与 Blog。
4. 增加 Projects 索引、Vela 专页和站点资产副本。
5. 下线 Tags UI 与 WebGL 组件，移除不再使用的依赖；保留只服务于旧路径构建的兼容数据。
6. 增加预渲染迁移页，检查新旧地址和静态产物。
7. 使用持续运行的 dev server 完成目标视口检查与维护者 review，再执行类型检查、生产构建和全仓相关门。

失败路径：任何框架门、静态路径或可访问性检查失败时，不完成交付且不执行部署；修复限定在 docs-app 与本 change 已声明路径。若 React Router v8 与当前 SSG/插件组合无法在既定范围内稳定工作，则保留信息架构实现、回退 docs-app 的框架依赖与 v8 专属代码，再更新 change 说明后重新验证。

回滚：代码层可整体回退本 change 的提交和 lockfile 变更。由于本次不部署、不修改外部数据、不改变 Vela 交付物，本地停止预览服务即可结束试用；不存在生产数据迁移或外部回滚动作。
