# ui-i18n-sync Specification (Delta)

## MODIFIED Requirements

### Requirement: 浏览器运行时文案拉取

系统 SHALL 在客户端 hydration 之后，通过浏览器从 studio 的 snapshot 接口异步拉取当前界面 namespace 的最新文案并合并进 i18next，使界面文案可在不重新构建/部署的情况下更新。运行时拉取 SHALL 不阻塞首屏，SHALL 在失败时静默回退到已打包的本地资源。由于运行时只有唯一 namespace `studio-ui`,拉取到的 flat 文案(key 形如 `common.nav.dashboard`)SHALL 作为整体合并进 `studio-ui` namespace,合并时 SHALL NOT 再按首段前缀拆分为多个 i18next namespace;flat key 直接作为 `studio-ui` 资源内的嵌套路径。

#### Scenario: 运行时合并最新文案

- **GIVEN** 系统中 `studio-ui` 文案已较本地 bundle 更新
- **WHEN** 用户在浏览器打开界面并完成 hydration
- **THEN** 客户端从 snapshot 拉取最新文案并合并进 `studio-ui` namespace，界面随之更新为最新文案

#### Scenario: 拉取失败回退本地资源

- **GIVEN** snapshot 接口不可达或返回错误
- **WHEN** 浏览器运行时尝试拉取
- **THEN** 界面继续使用已打包的本地资源，不出现空白或报错中断

#### Scenario: 不阻塞首屏

- **WHEN** 页面加载
- **THEN** 首屏由 SSR 注入的语言与本地资源即时渲染，运行时拉取在其后异步进行

#### Scenario: 合并不按前缀拆分 namespace

- **GIVEN** 拉取到的 flat 文案含 `common.nav.dashboard`、`landing.hero.title`
- **WHEN** 运行时合并
- **THEN** 二者均合并进唯一 `studio-ui` namespace(嵌套为 `common.nav.dashboard` / `landing.hero.title`),不产生 `common` / `landing` 等额外 i18next namespace

### Requirement: 文案拉取脚本（pull）

系统 SHALL 提供一个 pull 脚本，从 studio 系统拉取目标 namespace（经 `STUDIO_NAMESPACE` 配置，默认 `studio-ui`）的文案，落地为本地资源文件。脚本 SHALL NOT 硬编码受支持语种列表;SHALL 先调用语种清单接口 `GET /snapshot/:slug/meta` 获取该 namespace 的语种集与元信息,再据此逐个拉取各语种文案,并将语种元信息(`label`/`englishLabel`/`nativeLabel`)回写到本地元信息文件供 codegen 消费。本地资源 SHALL 落地为**单一文件** `locales/<lang>/<STUDIO_NAMESPACE>.json`(默认 `studio-ui.json`),其内容为该 namespace 的全部 flat key 还原成的嵌套对象(如 `{ common: { nav: { dashboard } }, landing: { hero: { title } } }`),SHALL NOT 按 key 首段前缀拆分为多个文件。pull 走公开 snapshot 时无需 token。脚本 SHALL 在接口返回错误时以非零退出码报告失败。

#### Scenario: 先查清单再拉文案

- **GIVEN** `studio-ui` 在系统中支持 `zh-cn`、`en-us`、`ja-jp`
- **WHEN** 运行 pull 脚本
- **THEN** 脚本先 `GET /snapshot/studio-ui/meta` 得到三语种清单,再逐个拉取三语种文案写入本地资源文件,且无需在脚本中硬编码这三个 code

#### Scenario: 落地为单一 namespace 文件

- **GIVEN** `studio-ui` 含 flat key `common.nav.dashboard`、`landing.hero.title`
- **WHEN** pull 完成
- **THEN** 本地写入单文件 `locales/<lang>/studio-ui.json`,内容为 `{ common: { nav: { dashboard: … } }, landing: { hero: { title: … } } }`,不再生成 `common.json` / `landing.json`

#### Scenario: 回写语种元信息

- **GIVEN** 清单接口返回各语种的 `nativeLabel` 等元信息
- **WHEN** pull 完成
- **THEN** 本地元信息文件被更新,包含各语种的显示名,供后续 codegen 生成 `generated.ts` 的语种元信息

#### Scenario: 拉取结果可被构建消费

- **GIVEN** pull 已更新本地资源文件与元信息文件
- **WHEN** 执行 codegen 与 typecheck/build
- **THEN** 构建成功且界面以最新文案与语种集渲染(pull 产物作为 SSR/首屏 fallback),`generated.ts` 的 `I18N_NAMESPACES` 为 `['studio-ui']`
