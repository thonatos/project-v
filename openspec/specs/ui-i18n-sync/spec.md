# ui-i18n-sync Specification

## Purpose
定义 i18n-studio 界面文案与自托管 namespace 之间的同步能力:界面文案自托管 namespace 与 seed、write scope token、push/pull 脚本、语种清单接口与浏览器运行时文案拉取,使界面文案成为 studio 系统中受管的翻译数据并可在不重新构建的情况下更新。
## Requirements
### Requirement: 语种清单接口

i18n-studio SHALL 提供 `GET /snapshot/:slug/meta` 作为语种清单端点,返回该 namespace 的受支持语种及其字典元信息,形如 `{ locales: [{ code, label, englishLabel, nativeLabel }], namespaces }`。语种集 SHALL 复用 snapshot 服务已算出的 `effectiveLocales`,元信息 SHALL 取自系统 `locales` 字典。鉴权 SHALL 沿用既有 snapshot 访问控制:`public_read` namespace 匿名可读,否则需有效 `readonly` token。该端点 SHALL NOT 改变既有 `GET /snapshot/:slug`(多语种 bundle)与 `GET /snapshot/:slug/:locale`(按单语种取文案)的路径与行为。

#### Scenario: 公开 namespace 匿名读清单

- **GIVEN** `studio-ui` namespace `public_read=1`,支持 `zh-cn`、`en-us`
- **WHEN** 匿名 `GET /snapshot/studio-ui/meta`
- **THEN** 返回 200,body 含 `locales` 数组,其中每项有 `code` 与字典元信息(`label`/`englishLabel`/`nativeLabel`),`code` 集合等于该 namespace 的 effectiveLocales

#### Scenario: 私有 namespace 需 token

- **GIVEN** 一个 `public_read=0` 的 namespace
- **WHEN** 不带 token `GET /snapshot/:slug/meta`
- **THEN** 返回 401;携带有效 `readonly` token 时返回 200 清单

#### Scenario: 既有快照端点行为不变

- **GIVEN** 既有集成调用 `GET /snapshot/studio-ui` 或 `GET /snapshot/studio-ui/zh-cn`
- **WHEN** 本变更部署后再次调用
- **THEN** 响应结构、缓存头与鉴权与变更前完全一致

### Requirement: 界面文案自托管 namespace

系统 SHALL 使用一个专用 namespace（slug `studio-ui`，已创建，locale `zh-cn`/`en-us`，`public_read=1`）承载 studio 自身界面文案，并提供 seed 将首批抽取的 key/文案灌入该 namespace，使界面文案成为 studio 系统中的受管翻译数据。该 namespace SHALL 与用户业务 namespace 隔离，不互相干扰。

#### Scenario: seed 灌入界面文案

- **GIVEN** 已存在的 `studio-ui` namespace
- **WHEN** 运行界面文案 seed
- **THEN** 系统将首批 key/文案写入 `studio-ui`，覆盖 `zh-cn` 与 `en-us`（重复运行幂等 upsert，不产生重复 entry）

#### Scenario: 与业务 namespace 隔离

- **WHEN** 操作 `studio-ui` namespace 的文案
- **THEN** 用户自有业务 namespace 的 entries 不受影响，反之亦然

### Requirement: write scope API token

系统 SHALL 在现有 token 模型（`readonly`/`task`）基础上新增 `write` scope token，用于授权脚本向 namespace 写入文案。`write` token SHALL 可在 token 管理界面创建与吊销，SHALL 使用独立前缀（如 `wr_`）以便识别，且 `import` 接口 SHALL 接受携带有效 `write` token 的请求（与既有 session role 鉴权并存）。

#### Scenario: 创建 write token

- **GIVEN** 管理员在 `studio-ui` 的 token 管理界面
- **WHEN** 选择 `write` scope 创建 token
- **THEN** 系统返回一次性明文 token（`wr_` 前缀），并在列表中记录其 prefix 与 scope

#### Scenario: import 接受 write token

- **GIVEN** 一个有效且未吊销的 `write` token
- **WHEN** 携带 `Authorization: Bearer <token>` 调用 `POST /api/namespaces/studio-ui/import`
- **THEN** 系统校验通过并写入文案，无需 session 登录

#### Scenario: 非 write token 被拒绝

- **GIVEN** 一个 `readonly` token
- **WHEN** 用它调用 import 接口
- **THEN** 系统返回 401/403，不写入文案

#### Scenario: 吊销后失效

- **GIVEN** 一个已吊销的 `write` token
- **WHEN** 用它调用 import 接口
- **THEN** 系统返回 401，不写入文案

### Requirement: 文案推送脚本（push）

系统 SHALL 提供一个 push 脚本,将**源码中实际使用的 key**（由 `i18n-key-extraction` 能力经 i18next-cli extract 刷新到本地 zh-cn 资源)中**系统尚不存在的 key** 推送到目标 namespace（经 `STUDIO_NAMESPACE` 配置,默认 `studio-ui`）,使用 `write` token 鉴权。push SHALL NOT 再盲目上传本地 `locales/` 全量;而是 SHALL 先运行 extract 刷新本地 key 集合,再经 snapshot 取目标 namespace 现有 key 集合,与本地 zh-cn key 做 diff,仅推送**新增/缺失**的 key 到源语言(`zh-cn`)。既有翻译 SHALL NOT 被该流程覆盖。脚本 SHALL 经 `dotenv` 从 `packages/apps/i18n-studio/.env` 读取配置（`STUDIO_BASE_URL` / `STUDIO_NAMESPACE` / `STUDIO_WRITE_TOKEN`）,并在接口返回错误时以非零退出码报告失败。`.env` SHALL 被 git 忽略,仓库仅提交 `.env.example`。

#### Scenario: 仅推送新增 key

- **GIVEN** 源码经 extract 后本地 zh-cn 含 `hero.title`、`hero.subtitle`,而系统 `studio-ui` 已存在 `hero.title`
- **WHEN** 运行 push 脚本
- **THEN** 脚本经 dotenv 加载凭据,先取系统现有 key 集合做 diff,仅把新增的 `hero.subtitle` 以 `write` token 调用 import 导入到 `studio-ui` 的 `zh-cn`,并打印导入结果

#### Scenario: 不覆盖既有翻译

- **GIVEN** 系统中 `hero.title` 已有人工翻译
- **WHEN** push 运行且本地也含 `hero.title`
- **THEN** 该 key 因系统已存在而不被推送,既有翻译保持不变

#### Scenario: 缺失凭据时报错退出

- **GIVEN** `.env` 缺少 `STUDIO_WRITE_TOKEN` 或 token 失效,或接口返回非 2xx
- **WHEN** 运行 push 脚本
- **THEN** 脚本打印错误详情并以非零退出码结束,不静默失败

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

