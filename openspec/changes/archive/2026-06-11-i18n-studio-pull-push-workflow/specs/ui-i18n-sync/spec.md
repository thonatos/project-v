# ui-i18n-sync Specification (Delta)

## MODIFIED Requirements

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

系统 SHALL 提供一个 pull 脚本,从 studio 系统拉取目标 namespace（经 `STUDIO_NAMESPACE` 配置,默认 `studio-ui`）的文案,落地为本地资源文件。脚本 SHALL NOT 硬编码受支持语种列表;SHALL 先调用语种清单接口 `GET /snapshot/:slug/meta` 获取该 namespace 的语种集与元信息,再据此逐个拉取各语种文案,并将语种元信息(`label`/`englishLabel`/`nativeLabel`)回写到本地元信息文件供 codegen 消费。pull SHALL 以**本地 zh-cn key 集合**(由 `i18n-key-extraction` 经 extract 产出)作为「应存在的 key 全集」:对系统中尚不存在或某语种未翻译的 key,本地资源 SHALL 写入占位（空串或与 extract 一致的占位策略）,以保证 bundle 完整、构建不因缺 key 失败。pull 走公开 snapshot 时无需 token。脚本 SHALL 在接口返回错误时以非零退出码报告失败。

#### Scenario: 先查清单再拉文案

- **GIVEN** `studio-ui` 在系统中支持 `zh-cn`、`en-us`、`ja-jp`
- **WHEN** 运行 pull 脚本
- **THEN** 脚本先 `GET /snapshot/studio-ui/meta` 得到三语种清单,再逐个拉取三语种文案写入本地资源文件,且无需在脚本中硬编码这三个 code

#### Scenario: 缺失 key 写占位

- **GIVEN** 本地 zh-cn 经 extract 含 `hero.cta`,而系统某语种 `en-us` 尚无该 key 翻译
- **WHEN** pull 完成
- **THEN** 本地 `en-us` 资源对 `hero.cta` 写入占位,不留空缺导致构建缺 key

#### Scenario: 回写语种元信息

- **GIVEN** 清单接口返回各语种的 `nativeLabel` 等元信息
- **WHEN** pull 完成
- **THEN** 本地元信息文件被更新,包含各语种的显示名,供后续 codegen 生成 `generated.ts` 的语种元信息

#### Scenario: 拉取结果可被构建消费

- **GIVEN** pull 已更新本地资源文件与元信息文件
- **WHEN** 执行 codegen 与 typecheck/build
- **THEN** 构建成功且界面以最新文案与语种集渲染（pull 产物作为 SSR/首屏 fallback）
