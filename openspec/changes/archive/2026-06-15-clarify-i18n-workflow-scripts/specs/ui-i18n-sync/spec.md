## MODIFIED Requirements

### Requirement: 文案拉取脚本（pull）

系统 SHALL 提供一个 pull 脚本，从 studio 系统拉取目标 namespace（经 `STUDIO_NAMESPACE` 配置，默认 `studio-ui`）的文案，落地为本地资源文件。脚本 SHALL NOT 硬编码受支持语种列表;SHALL 先调用语种清单接口 `GET /snapshot/:slug/meta` 获取该 namespace 的语种集与元信息,再据此逐个拉取各语种文案,并将语种元信息(`label`/`englishLabel`/`nativeLabel`)回写到本地元信息文件供 codegen 消费。本地资源 SHALL 落地为**单一文件** `locales/<lang>/<STUDIO_NAMESPACE>.json`(默认 `studio-ui.json`),其内容为该 namespace 的全部 flat key 还原成的嵌套对象(如 `{ common: { nav: { dashboard } }, landing: { hero: { title } } }`),SHALL NOT 按 key 首段前缀拆分为多个文件。pull 走公开 snapshot 时无需 token。脚本 SHALL 在接口返回错误时以非零退出码报告失败。pull 工作流 SHALL 在所有语种资源与元信息成功写入后刷新 `app/i18n/generated.ts`,使开发者执行 `i18n:pull` 后即得到可被构建消费的本地 bundle;若拉取存在失败项,流程 SHALL 以非零退出且 SHALL NOT 基于半成品资源刷新生成物。

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

#### Scenario: 拉取成功后自动刷新生成物

- **GIVEN** pull 已成功更新本地资源文件与元信息文件
- **WHEN** `i18n:pull` 流程结束
- **THEN** `app/i18n/generated.ts` 已按最新 `locales/` 与 `_meta.json` 刷新,构建成功且界面以最新文案与语种集渲染,`I18N_NAMESPACES` 为 `['studio-ui']`

#### Scenario: 拉取失败不刷新生成物

- **GIVEN** pull 已写入部分语种资源,但至少一个语种接口返回错误
- **WHEN** `i18n:pull` 流程结束
- **THEN** 命令以非零退出码报告失败,且不运行 codegen 刷新 `app/i18n/generated.ts`
