## ADDED Requirements

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

## MODIFIED Requirements

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
