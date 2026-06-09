# ui-i18n-sync Specification

## Purpose
TBD - created by archiving change i18n-studio-react-i18next. Update Purpose after archive.
## Requirements
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

系统 SHALL 提供一个 pull 脚本，从 studio 系统（snapshot 或 export 接口）拉取目标 namespace（经 `STUDIO_NAMESPACE` 配置，默认 `studio-ui`）的文案，落地为本地资源文件，覆盖各受支持 locale，使本地资源可与系统保持一致并固化进构建。pull 走公开 snapshot 时无需 token。

#### Scenario: 从系统拉取文案到本地

- **WHEN** 运行 pull 脚本
- **THEN** 脚本从系统拉取各 locale 文案并写入本地资源文件，文件结构与 i18next 资源加载约定一致

#### Scenario: 拉取结果可被构建消费

- **GIVEN** pull 已更新本地资源文件
- **WHEN** 执行 typecheck/build
- **THEN** 构建成功且界面以最新文案渲染（pull 产物作为 SSR/首屏 fallback）

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
