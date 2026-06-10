## Why

i18n-studio 的「支持哪些 UI 语种」这一事实当前被定义了 **5 处**:`lib/i18n.ts`(`SUPPORTED_LANGS` / `Lang` 联合类型)、`i18n/config.ts`(静态 import 与手写 `resources` 映射)、`components/lang-toggle.tsx`(手写两个 `ToggleGroupItem`)、`i18n/locales/` 目录、`scripts/i18n-pull.mjs`(又一份硬编码 `SUPPORTED_LANGS=['zh-cn','en-us']`)。新增一个语种需要同步改动 5 个地方,极易漏改;且真正带元信息(`label`/`nativeLabel`)的权威数据(`locales` 字典表)反而没参与 UI 语言的任何决策。

与此同时,`scripts/repair-locales.ts` 是在用一个常驻巡检脚本补救数据模型缺陷:`namespaces.locales` 是 JSON 字符串数组,与 `locales` 字典表之间没有外键约束,可能产生「引用了字典里不存在的 code」的孤儿数据,且 `JSON.parse(ns.locales)` 的防御性解析重复散落在至少三处。

这三个问题同一个根因:**语种信息缺少单一权威源**。本次将其收敛。

## What Changes

- **新增语种清单接口** `GET /snapshot/:slug/meta`:返回 `{ locales: [{ code, label, englishLabel, nativeLabel }], namespaces }`。逻辑复用 `snapshot.server.ts` 中 `getBundle` 已算出的 `meta.effectiveLocales`,几乎零成本。它成为「有哪些语种 + 叫什么名」的唯一网络权威源。既有 `GET /snapshot/:slug`(多语种 bundle)与 `GET /snapshot/:slug/:locale`(单语种)路径与契约完全不变。

- **codegen 生成 UI 语种配置**:新增构建期脚本,扫描 `app/i18n/locales/` 目录(语种 = 子目录名,resources = 各 `<ns>.json`)+ 读取本地语种元信息文件,生成 `app/i18n/generated.ts`,导出 `SUPPORTED_LANGS`、`resources` 映射、语种元信息(`label`/`nativeLabel`)。`config.ts` 与 `lib/i18n.ts` 改为**消费生成物**,不再手写。保留同步 init / 静态 bundle,避免 SSR 首帧 FOUC。codegen **离线优先**:DB 为空、studio 未运行时(全新 clone / CI 构建)仍能靠已提交的 `locales/` + 元信息文件跑通。

- **i18n-pull 改为先查清单再拉文案**:`i18n-pull.mjs` 删除硬编码的 `SUPPORTED_LANGS`,改为先 `GET /snapshot/:slug` 拿语种清单决定拉哪些语种,并把元信息回写到本地(供 codegen 生成显示名)。

- **语言切换器改为可扩展下拉**:`lang-toggle.tsx` 从手写 `ToggleGroup`(两项平铺,3+ 语种会撑爆且需改 JSX)改为复用项目已有的 `Command` + `Popover` 下拉模式(参考 `locale-multi-select.tsx` 的单选版),item 遍历 `SUPPORTED_LANGS`,显示名优先用母语名 `nativeLabel`。

- **消除 repair 脚本(一次性解决)**:跑一次清理历史孤儿数据后,所有写 `namespaces.locales` 的路径强制调用已存在的 `assertLocalesExist` 守卫,保证不再产生孤儿;随后**删除** `scripts/repair-locales.ts` 与 `repair:locales` npm script。同时抽出重复的 `JSON.parse(ns.locales)` 防御性解析为单一工具函数。**BREAKING**(脚本层面):`pnpm -F i18n-studio repair:locales` 命令不再存在。

## Capabilities

### New Capabilities
- `i18n-locale-codegen`:构建期 codegen,从 `app/i18n/locales/` 目录 + 本地语种元信息派生 `SUPPORTED_LANGS` / `resources` / 语种元信息;离线可跑,保留同步 SSR init。

### Modified Capabilities
- `ui-i18n`:界面语言初始化与切换控件不再硬编码语种集,改为消费 codegen 生成物;切换器从平铺 toggle 改为遍历语种列表的可搜索下拉,显示名用 `nativeLabel`。
- `ui-i18n-sync`:新增 `GET /snapshot/:slug` 语种清单接口;`i18n-pull` 脚本改为先查清单再拉文案,不再硬编码语种列表。
- `i18n-locale-management`:`namespaces.locales` 的写入路径强制经 `assertLocalesExist` 守卫,保证字典引用完整性;不再依赖事后 repair 巡检脚本。

## Impact

- **新增文件**:`app/i18n/generated.ts`(codegen 产物,提交进仓库)、codegen 脚本(如 `scripts/i18n-codegen.mjs`)、本地语种元信息文件(如 `app/i18n/locales/_meta.json`)、`namespaces.locales` 解析工具函数。
- **修改文件**:`lib/i18n.ts`、`i18n/config.ts`(消费生成物)、`components/lang-toggle.tsx`(改下拉)、`scripts/i18n-pull.mjs`(先查清单)、`lib/services/snapshot.server.ts` + 新增 `app/routes/snapshot.$slug.meta.tsx`(新增清单 loader)、`lib/services/namespace.server.ts`(写入路径加守卫)、`lib/services/locale.server.ts`(复用解析工具)。
- **删除文件/脚本**:`app/scripts/repair-locales.ts`、`package.json` 的 `repair:locales` script。
- **构建链**:新增一个 codegen 步骤,需接入 `build` / `typecheck` 前置(或纳入 `i18n:pull` 之后),确保 `generated.ts` 与 `locales/` 一致。
- **行为契约**:`/snapshot/:slug/:locale`(按单语种取文案)路径与行为完全不变;新增的是不带 locale 的清单端点,不破坏既有集成。
- **自闭环特例**:`app/i18n/locales/*.json` 仍是 seed 输入 + pull 输出 + SSR fallback 的 bootstrap 根;清单接口仅在 pull 时增量喂入,非 codegen 硬依赖。
- **回滚计划**:本次以新增 + 改名为主。codegen 产物 `generated.ts` 提交进仓库,可整体 `git revert`;清单接口为纯新增端点,revert 后 `i18n-pull` 回退到硬编码语种列表的旧版本即可;repair 脚本删除前先确认一次性清理已完成,如需回滚可从 git 历史恢复脚本与 npm script。数据库无 schema 变更(本次走「守卫保证完整性」而非引入外键关联表),故无 migration 回滚负担。
