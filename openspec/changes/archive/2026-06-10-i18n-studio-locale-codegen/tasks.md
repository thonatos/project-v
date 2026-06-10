## 1. namespace 写入守卫与解析收敛(先堵洞)

- [x] 1.1 在 `app/lib/services/` 抽出 `parseNsLocales(raw: string): string[]` 工具函数(JSON.parse + try/catch + Array.isArray + 过滤非 string),作为读取 `namespaces.locales` 的唯一入口
- [x] 1.2 将 `locale.server.ts` 的 `listReferencingNamespaces` 改为调用 `parseNsLocales`,移除内联解析
- [x] 1.3 审计所有写入 `namespaces.locales` 的路径(`namespace.server.ts` 的 create/update),在持久化前调用 `assertLocalesExist`
- [x] 1.4 为「创建/更新引用字典外或禁用 code 被拒」「合法写入通过」补单测(对齐 i18n-locale-management delta 的 Scenario)

## 2. 历史孤儿数据一次性清理

- [x] 2.1 在已接入写入守卫后,运行一次性清理处理历史孤儿引用(复用现有 `repairLocales({ autoAdd: true })` 逻辑跑最后一次,或写最小清理脚本)
- [x] 2.2 确认清理后 `namespaces.locales` 中不再存在字典外 code(可用现有报告模式核验输出 "No repair needed.")

## 3. 语种清单接口 `GET /snapshot/:slug/meta`

- [x] 3.1 在 `snapshot.server.ts` 新增服务方法,返回 `{ locales: [{ code, label, englishLabel, nativeLabel }], namespaces }`,语种集复用 `effectiveLocales`,元信息 join 系统 `locales` 字典
- [x] 3.2 新增路由 `app/routes/snapshot.$slug.meta.tsx` 的 loader,沿用 `requireSnapshotAccess` 鉴权(public_read 匿名 / 否则 readonly token)
- [x] 3.3 确认既有 `snapshot.$slug._index.tsx`(多语种 bundle)与 `snapshot.$slug.$locale.tsx`(单语种)路径与行为不受影响(路由优先级、缓存头)
- [x] 3.4 补集成测试:公开 namespace 匿名读清单 200、私有 namespace 无 token 401 / 有 token 200、既有快照端点行为不变
- [x] 3.5 在 `public/openapi.json` 增补 `/snapshot/{slug}/meta` 端点文档(对齐 check:openapi-coverage)

## 4. 改造 i18n:pull(先查清单再拉文案)

- [x] 4.1 `scripts/i18n-pull.mjs` 删除硬编码的 `SUPPORTED_LANGS`,改为先 `GET /snapshot/:slug/meta` 取语种清单
- [x] 4.2 据清单逐个拉取 `GET /snapshot/:slug/:locale` 写入 `app/i18n/locales/<lang>/<ns>.json`(保留排序/缩进/稳定 diff)
- [x] 4.3 把清单返回的语种元信息(`label`/`englishLabel`/`nativeLabel`)回写到本地元信息文件(`app/i18n/locales/_meta.json`)
- [x] 4.4 接口失败时以非零退出码报告,不静默失败

## 5. codegen 生成 `app/i18n/generated.ts`

- [x] 5.1 新增 codegen 脚本(如 `scripts/i18n-codegen.mjs`):扫描 `app/i18n/locales/` 子目录得到语种列表,收集各 `<ns>.json`
- [x] 5.2 读取 `_meta.json` 得到语种元信息;元信息缺失时降级用 `code` 作为显示名,不报错
- [x] 5.3 生成 `app/i18n/generated.ts`,导出 `SUPPORTED_LANGS`、`resources`(静态映射)、语种元信息数组(`LOCALE_META`);输出稳定顺序以保证 diff 干净
- [x] 5.4 新增 `i18n:codegen` npm script,并接入 `build` / `typecheck` 前置(保证全新 clone 首次构建即正确)

## 6. config / lib 消费生成物

- [x] 6.1 `app/lib/i18n.ts` 改为从 `generated.ts` 派生 `SUPPORTED_LANGS` 与 `Lang` 类型,移除手写联合类型与硬编码列表
- [x] 6.2 `app/i18n/config.ts` 改为从 `generated.ts` 取 `resources` / `supportedLngs` / `ns`,移除逐个 `import` locale JSON;保留同步 init / `lowerCaseLng` / `initAsync: false`
- [x] 6.3 验证 SSR 首帧无 FOUC(已 key 化文案直接渲染为目标语言,无 raw key)

## 7. 语言切换器改下拉

- [x] 7.1 重写 `app/components/lang-toggle.tsx`:改用 `Popover` + `Command` 单选下拉(参考 `locale-multi-select.tsx`)
- [x] 7.2 选项遍历 `SUPPORTED_LANGS` 动态生成,显示名优先 `nativeLabel`、回退 `label`、再回退 `code`
- [x] 7.3 选中后 `i18n.changeLanguage` + 提交 `/api/lang`,保持原有 cookie 写入与免刷新切换
- [x] 7.4 手测 3+ 语种场景下控件不溢出、可搜索、切换正常

## 8. 移除 repair 脚本

- [x] 8.1 删除 `app/scripts/repair-locales.ts`
- [x] 8.2 删除 `package.json` 的 `repair:locales` script
- [x] 8.3 删除/迁移 repair 相关测试(`tests/` 下针对 repair-locales 的用例)

## 9. 验证与收尾

- [x] 9.1 `pnpm -F i18n-studio typecheck` 通过
- [x] 9.2 `pnpm -F i18n-studio test` 通过
- [x] 9.3 `pnpm -F i18n-studio build` 通过(含 codegen 前置)
- [x] 9.4 离线场景验证:模拟空 DB / studio 未运行,codegen + build 仍成功且无网络请求
- [x] 9.5 端到端手测:pull → codegen → 切换器多语种 → SSR 首帧无 FOUC
- [x] 9.6 更新 `.env.example` / 文档中涉及 pull 与语种的说明(如有)
