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

系统 SHALL 提供一个 push 脚本，将本地界面资源文件（提取的 key/文案）通过 studio 的 import 接口导入到目标 namespace，使用 `write` token 鉴权。脚本 SHALL 经 `dotenv` 从 `packages/apps/i18n-studio/.env` 读取配置（`STUDIO_BASE_URL` / `STUDIO_NAMESPACE` / `STUDIO_WRITE_TOKEN`），目标 namespace slug 经 `STUDIO_NAMESPACE` 配置（默认 `studio-ui`）而非写死，SHALL 支持按 locale 推送，并在接口返回错误时以非零退出码报告失败。`.env` SHALL 被 git 忽略，仓库仅提交 `.env.example`。

#### Scenario: 推送本地文案到系统

- **GIVEN** 本地资源文件包含 `zh-cn` 与 `en-us` 文案，且 `.env` 配置了有效 `STUDIO_WRITE_TOKEN`
- **WHEN** 运行 push 脚本
- **THEN** 脚本经 dotenv 加载凭据，对每个 locale 携带 `write` token 调用 import 接口，文案落入 `studio-ui` namespace，并打印每个 locale 的导入结果

#### Scenario: 缺失凭据时报错退出

- **GIVEN** `.env` 缺少 `STUDIO_WRITE_TOKEN` 或 token 失效，或接口返回非 2xx
- **WHEN** 运行 push 脚本
- **THEN** 脚本打印错误详情并以非零退出码结束，不静默失败

### Requirement: 文案拉取脚本（pull）

系统 SHALL 提供一个 pull 脚本，从 studio 系统拉取目标 namespace（经 `STUDIO_NAMESPACE` 配置，默认 `studio-ui`）的文案，落地为本地资源文件。脚本 SHALL NOT 硬编码受支持语种列表;SHALL 先调用语种清单接口 `GET /snapshot/:slug/meta` 获取该 namespace 的语种集与元信息,再据此逐个拉取各语种文案,并将语种元信息(`label`/`englishLabel`/`nativeLabel`)回写到本地元信息文件供 codegen 消费。pull 走公开 snapshot 时无需 token。脚本 SHALL 在接口返回错误时以非零退出码报告失败。

#### Scenario: 先查清单再拉文案

- **GIVEN** `studio-ui` 在系统中支持 `zh-cn`、`en-us`、`ja-jp`
- **WHEN** 运行 pull 脚本
- **THEN** 脚本先 `GET /snapshot/studio-ui/meta` 得到三语种清单,再逐个拉取三语种文案写入本地资源文件,且无需在脚本中硬编码这三个 code

#### Scenario: 回写语种元信息

- **GIVEN** 清单接口返回各语种的 `nativeLabel` 等元信息
- **WHEN** pull 完成
- **THEN** 本地元信息文件被更新,包含各语种的显示名,供后续 codegen 生成 `generated.ts` 的语种元信息

#### Scenario: 拉取结果可被构建消费

- **GIVEN** pull 已更新本地资源文件与元信息文件
- **WHEN** 执行 codegen 与 typecheck/build
- **THEN** 构建成功且界面以最新文案与语种集渲染（pull 产物作为 SSR/首屏 fallback）

### Requirement: 浏览器运行时文案拉取

系统 SHALL 在客户端 hydration 之后，通过浏览器从 studio 的 snapshot 接口异步拉取当前界面 namespace 的最新文案并合并进 i18next，使界面文案可在不重新构建/部署的情况下更新。运行时拉取 SHALL 不阻塞首屏，SHALL 在失败时静默回退到已打包的本地资源。

#### Scenario: 运行时合并最新文案

- **GIVEN** 系统中 `studio-ui` 文案已较本地 bundle 更新
- **WHEN** 用户在浏览器打开界面并完成 hydration
- **THEN** 客户端从 snapshot 拉取最新文案并合并，界面随之更新为最新文案

#### Scenario: 拉取失败回退本地资源

- **GIVEN** snapshot 接口不可达或返回错误
- **WHEN** 浏览器运行时尝试拉取
- **THEN** 界面继续使用已打包的本地资源，不出现空白或报错中断

#### Scenario: 不阻塞首屏

- **WHEN** 页面加载
- **THEN** 首屏由 SSR 注入的语言与本地资源即时渲染，运行时拉取在其后异步进行
