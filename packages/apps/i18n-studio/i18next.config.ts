/**
 * i18next-cli 配置 —— 源码翻译 key 的提取引擎。
 *
 * 设计要点（详见 openspec 变更 i18n-studio-pull-push-workflow / design.md）:
 * - 源码是 key 的唯一权威来源:组件只写 `t('ns.key')`,不携带默认文案。
 * - 提取产物对齐运行时:`output` 直出 `app/i18n/locales/<lang>/<ns>.json` 嵌套结构,
 *   `keySeparator: '.'`、`locales`/`primaryLanguage` 与 `app/i18n/generated.ts` 一致,
 *   使既有 `i18n:codegen` 可直接消费,且与现有 JSON 格式 diff 干净。
 * - `primaryLanguage: 'zh-cn'`(= generated 的 DEFAULT_LANG);新 key 以空串占位写入,
 *   zh-cn 实际文案由人工在 JSON / studio 填写。
 * - `removeUnusedKeys` 清理源码已删除的静态 key;`preservePatterns` 保留运行时拼接的动态 key。
 *
 * 仅在脚本/构建期使用(devDependency),不进运行时 bundle。
 */
import { defineConfig } from 'i18next-cli';

export default defineConfig({
  // 与 app/i18n/generated.ts 的 SUPPORTED_LANGS 对齐;新增语种由 pull 落地后在此同步。
  locales: ['zh-cn', 'en-us'],

  extract: {
    input: ['app/**/*.{ts,tsx}'],
    output: 'app/i18n/locales/{{language}}/{{namespace}}.json',

    // 运行时用默认 `.` keySeparator + 单 namespace 组织,提取须一致。
    keySeparator: '.',
    nsSeparator: ':',
    // 唯一 namespace = studio-ui;组件写 t('common.nav.x'),`common`/`landing`
    // 只是 key 前缀。spike 已验证:此配置下 t('common.nav.dashboard') 归属
    // ns=studio-ui、产物落到 studio-ui.json 的 { common: { nav: { dashboard } } }。
    defaultNS: 'studio-ui',

    // 源码只写 t('ns.key'),新 key 占位为空串(实际文案在 JSON / studio)。
    defaultValue: '',

    // 与现有 JSON 格式一致:2 空格缩进 + key 排序,保证产物确定性。
    indentation: 2,
    sort: true,

    // 源语言 = generated 的 DEFAULT_LANG;其余语种由 pull 从 studio 回灌。
    primaryLanguage: 'zh-cn',

    // 源码删除的静态 key 同步从本地资源移除;清理只作用于本地,不触及 studio 词条。
    removeUnusedKeys: true,

    // 保留运行时动态拼接的 key,避免被 removeUnusedKeys 误删。
    // landing/features.tsx 用 `t(`landing.features.${f.key}.title`)` / `.body` 动态取词,
    // 静态提取看不到,必须在此显式保留整个 landing.features.* 子树(单 ns 内的完整 key)。
    preservePatterns: ['landing.features.*'],

    // 同一 ns:key 出现不同默认值时告警(本项目默认值恒为空串,主要防误用)。
    warnOnConflicts: true,
  },
});
