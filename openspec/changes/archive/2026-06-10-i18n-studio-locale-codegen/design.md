## Context

i18n-studio 的「支持哪些 UI 语种」当前被硬编码在 5 处(`lib/i18n.ts`、`i18n/config.ts`、`components/lang-toggle.tsx`、`i18n/locales/` 目录、`scripts/i18n-pull.mjs`),且真正带元信息的权威数据(`locales` 字典表)未参与 UI 语言决策。

本项目有一个特殊约束 —— **自闭环 / 自己吃自己的狗粮**:studio 自身的 UI 文案,就是 studio 里 `studio-ui` 这个 namespace 的翻译数据。这造成「先有蛋鸡才能下蛋」的循环:UI 要显示文案 → 文案来自 `studio-ui` → 但 studio 还没跑起来就没有数据。该循环靠 `app/i18n/locales/*.json`(提交进仓库)打破:它既是 `seed` 的输入(冷启动灌库),又是 `i18n:pull` 的输出(运行后回写),还是 SSR 的 fallback bundle。

普通消费方项目则是线性的:在 studio 建 namespace → 翻译 → `i18n:pull` → 本地有文案。本项目是这条线性流程的特例(bootstrap 根在仓库里)。

关键技术约束(来自 `i18n/config.ts` 注释):资源**必须静态 bundle、同步 init**,否则 SSR 首帧 `t()` 返回 raw key,产生 FOUC。这排除了「运行时从 DB 派生语种集」的方案。

## Goals / Non-Goals

**Goals:**
- 「支持哪些语种 + 叫什么名」收敛到**单一权威源**,新增语种不再需要改 5 处代码。
- codegen **离线可跑**:DB 为空、studio 未运行(全新 clone / CI)时,构建仍能产出正确的 `generated.ts`,SSR 不崩。
- 保留同步 init / 静态 bundle,无 SSR FOUC。
- 语言切换器对任意语种数量(含 3+)可用,显示母语名。
- 消除 `repair-locales.ts` 巡检脚本,改为写入路径守卫保证字典引用完整性。

**Non-Goals:**
- **不**做运行时语种派生(self-hosted 用户在 dashboard 加语种后 UI 立即多一个选项、免重新部署)—— 与同步 SSR init 冲突,且非当前诉求。
- **不**引入 `namespace_locales` 关联表 / 外键(无 DB schema 变更);本次走「守卫 + 一次性清理」而非数据模型重构。
- **不**改动 `/snapshot/:slug/:locale`(按单语种取文案)的路径与行为。
- **不**为消费方项目改变 `i18n:pull` 的对外契约(仍写 `app/i18n/locales/<lang>/<ns>.json`)。

## Decisions

### 决策 1:UI 语种走 codegen(构建时),而非 runtime 派生

**选择**:新增构建期脚本扫描 `app/i18n/locales/`,生成 `app/i18n/generated.ts`,导出 `SUPPORTED_LANGS`、`resources`、语种元信息;`config.ts` / `lib/i18n.ts` 消费生成物。

**理由**:同步 init 要求首帧就有完整 resources。codegen 在构建期把目录扫描结果固化成静态 import,完美契合现有「静态 bundle」设计,且产物可提交、可 diff、可离线复现。

**备选(已否决)**:
- *runtime 派生*(root loader 从 `locales` 表注入 `SUPPORTED_LANGS`):需解决首帧 init 的保底语种集问题,复杂度高,且与同步 SSR 冲突。仅当目标是「免重新部署加语种」才值得,非当前诉求。
- *继续手写*:即现状,5 处硬编码,否决。

### 决策 2:codegen 输入源分层 —— 目录(离线权威)+ 清单接口(在线增量)

**选择**:
- **语种列表 + resources**:扫 `app/i18n/locales/` 子目录名 + 各 `<ns>.json`。**离线可靠**,构建时必然存在。
- **语种元信息(label / nativeLabel)**:来自本地元信息文件(如 `app/i18n/locales/_meta.json`),该文件由 `i18n:pull` 从清单接口拉取后回写。

**理由**:职责分离让 codegen 不硬依赖运行中的 studio。清单接口连不上时,codegen 仍能靠已提交的 `locales/` + `_meta.json` 跑通。元信息缺失时降级用 code 自身作为显示名。

**备选(已否决)**:*纯扫目录、元信息另维护一张手写表* —— 又引入一处手写,违背收敛初衷;*codegen 直接打接口* —— 破坏离线可跑性,CI 构建会失败。

### 决策 3:新增 `GET /snapshot/:slug/meta` 语种清单接口

**选择**:新增 `GET /snapshot/:slug/meta` 清单端点,返回 `{ locales: [{ code, label, englishLabel, nativeLabel }], namespaces }`。复用 `snapshot.server.ts` 的 `getBundle` 已算出的 `meta.effectiveLocales`,补充字典元信息。鉴权沿用 `requireSnapshotAccess`(public_read 或 readonly token)。

**理由**:让「语种是什么 + 叫什么名」有唯一网络权威源,`i18n:pull` / codegen / 未来消费方都从它派生。逻辑几乎已存在,增量极小。既有 `GET /snapshot/:slug`(多语种 bundle)与 `GET /snapshot/:slug/:locale`(单语种)路径已被占用且是对外契约,故清单走 `/meta` 子路径,零破坏。

**备选(已否决)**:
- *复用既有 `GET /snapshot/:slug` 加 `?meta=1`* —— 一个端点两种返回形态,契约混乱。
- *让 pull 继续硬编码语种列表* —— 即问题本身。
- *仅从既有 bundle 的 `locales` map key 推导语种* —— 能拿到 code 但拿不到元信息(`nativeLabel`),问题 2 的显示名无处可取。

### 决策 4:切换器复用 Command + Popover 下拉

**选择**:`lang-toggle.tsx` 改用 `Command` + `Popover`(单选版,参考 `locale-multi-select.tsx`),item 遍历 `SUPPORTED_LANGS`,显示名优先 `nativeLabel`,回退 `label`,再回退 `code`。

**理由**:平铺 toggle 在 3+ 语种横向爆炸且需手改 JSX。下拉模式项目已有成熟实现,触发器仅占一格,自带搜索。母语名是语言切换器最佳实践(日本用户找「日本語」而非「Japanese」)。

**备选(已否决)**:*原生 `<select>`* —— 与 shadcn 视觉不一致;*保留 toggle 仅遍历化* —— 不解决 3+ 横向空间问题。

### 决策 5:repair 一次性清理 + 写入守卫,删除巡检脚本

**选择**:
1. 跑一次清理,处理历史孤儿引用(`namespaces.locales` 中不存在于字典的 code)。
2. 所有写 `namespaces.locales` 的路径强制调用已存在的 `assertLocalesExist`。
3. 抽出 `JSON.parse(ns.locales)` 防御性解析为单一工具函数(如 `parseNsLocales`),替换散落三处的重复实现。
4. 删除 `scripts/repair-locales.ts` 与 `repair:locales` npm script。

**理由**:repair 脚本是补救「JSON blob 无外键」的常驻巡检设施。`assertLocalesExist` 守卫已写好,若所有写入路径都先调它,孤儿数据根本无法产生,巡检设施即可退役。用户已确认孤儿是历史包袱、非持续产生,故一次性清理即可,无需引入关联表。

**备选(已否决)**:*引入 `namespace_locales` 关联表 + 外键* —— DB 层根治但需 migration,成本高,超出本次范围(列为未来可选)。

### 数据流总览

```
                 locales 表 (DB, 权威 + 元信息)
                       │
          ┌────────────┴───────────────┐
          ▼                            ▼
  GET /snapshot/:slug/meta       dashboard 业务字典 UI (已有)
  (清单: code+label+nativeLabel)
          │
          ├──────────────┬───────────────┐
          ▼              ▼               ▼
   i18n:pull      (codegen 在线时)   未来消费方
   ① 拿清单决定拉哪些                  从同一接口派生
   ② 逐个 GET /snapshot/:slug/:locale
   ③ 回写元信息 _meta.json
          │
          ▼
  app/i18n/locales/<lang>/<ns>.json  +  _meta.json   ← bootstrap 根 (提交进仓库)
          │
          ▼
  codegen (扫目录 + 读 _meta.json,离线可跑)
          │
          ▼
  app/i18n/generated.ts
  ├ SUPPORTED_LANGS   (子目录名)
  ├ resources         (各 ns.json 静态 import)
  └ LOCALE_META[]     (label / nativeLabel)
          │
   ┌──────┼─────────────────┐
   ▼      ▼                 ▼
config.ts  lib/i18n.ts   lang-toggle.tsx
(同步init) (Lang/SUPPORTED) (遍历+nativeLabel)
```

### i18n:pull 时序(在线增量)

```
开发者         i18n-pull.mjs        studio (/snapshot)        本地文件
  │  pnpm i18n:pull  │                     │                      │
  │─────────────────>│                     │                      │
  │                  │ GET /snapshot/:slug/meta                   │
  │                  │────────────────────>│                      │
  │                  │ {locales[],namespaces}                     │
  │                  │<────────────────────│                      │
  │                  │  写 _meta.json (元信息)                     │
  │                  │───────────────────────────────────────────>│
  │                  │ for each locale:    │                      │
  │                  │ GET /snapshot/:slug/:locale                │
  │                  │────────────────────>│                      │
  │                  │ {flat keys}         │                      │
  │                  │<────────────────────│                      │
  │                  │  写 <lang>/<ns>.json │                      │
  │                  │───────────────────────────────────────────>│
  │  (之后跑 codegen 扫目录 → generated.ts) │                      │
```

## Risks / Trade-offs

- **codegen 产物与 `locales/` 不同步** → 把 codegen 接入 `build` / `typecheck` 前置步骤(或 `i18n:pull` 之后自动跑),并在 CI 校验 `generated.ts` 无未提交 diff,防止手改目录后忘记重新生成。
- **加语种仍需重新构建/部署** → 这是 codegen 方案的固有取舍(决策 1 已明确为 Non-Goal)。若未来需要免部署加语种,另起 runtime 派生 change。
- **清单接口暴露语种元信息给匿名用户**(public_read namespace) → 元信息(语种名)本就非敏感;鉴权沿用既有 `requireSnapshotAccess`,private namespace 仍需 token,与单语种端点一致。
- **删除 repair 脚本后若仍有写入路径绕过守卫** → 迁移前审计所有写 `namespaces.locales` 的路径(create/update namespace),确保全部经 `assertLocalesExist`;一次性清理与守卫接入须在同一 change 内完成,顺序为「先加守卫 → 再清理 → 最后删脚本」。
- **`_meta.json` 缺失或损坏** → codegen 降级:元信息缺失时用 `code` 作为显示名,不阻断构建。

## Migration Plan

1. **加守卫**:在 namespace 写入路径接入 `assertLocalesExist`,抽出 `parseNsLocales` 工具替换三处重复解析。
2. **一次性清理**:运行清理处理历史孤儿引用(沿用现有 repair 逻辑跑最后一次,或写一次性脚本)。
3. **新增清单接口** `GET /snapshot/:slug` + 服务层方法。
4. **改造 pull**:`i18n-pull.mjs` 先查清单再拉文案,回写 `_meta.json`。
5. **codegen**:新增脚本生成 `generated.ts`,接入构建链;`config.ts` / `lib/i18n.ts` 改为消费生成物。
6. **切换器**:`lang-toggle.tsx` 改 Command + Popover 下拉。
7. **清理**:删除 `repair-locales.ts` 与 `repair:locales` script。
8. **验证**:`typecheck` + `test` + 手测 SSR 首帧无 FOUC、切换器在多语种下正常。

**回滚**:`generated.ts` 已提交,可整体 `git revert`;清单接口为纯新增端点;repair 脚本删除前确认清理完成,需要时从 git 历史恢复。无 DB schema 变更,无 migration 回滚负担。

## Open Questions

- `_meta.json` 的落点:放 `app/i18n/locales/_meta.json` 还是 `app/i18n/locale-meta.json`?(倾向前者,与 locales 同目录,pull 一并维护)
- codegen 接入点:独立 `i18n:codegen` script 由 `build`/`typecheck` 前置调用,还是并入 `i18n:pull` 末尾?(倾向独立 script + 构建前置,保证 clone 后首次 build 即正确)
- 一次性清理:复用现有 `repairLocales({autoAdd:true})` 跑最后一次后再删,还是新写一个最小清理脚本?(倾向复用,跑完即删,避免重复逻辑)
