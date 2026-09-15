import { MESSAGES } from './messages.js';

// 插件自带的语言目录。zh 是基准语言（改动前聊天里就是中文），因此默认值保持 'zh'：
// 既有部署升级后行为不变，其它语言由配置显式选择。
export const LOCALES = Object.freeze(Object.keys(MESSAGES));

export const DEFAULT_LOCALE = 'zh';

// 形如 `{name}` 的占位符。只替换 catalog 里已知的参数，未知占位符原样保留，
// 便于在测试里发现模板与调用点不一致。
const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * 归一化配置里的语言值：接受大小写与地区后缀（`zh-CN`、`en-US`、`ru-RU` 都可），
 * 无法识别时回落到默认语言。
 * @param value - 配置或环境里读到的原始值。
 * @returns 已注册的语言 id。
 */
export function normalizeLocale(value) {
  const requested = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!requested) return DEFAULT_LOCALE;
  const locale = LOCALES.find((candidate) => candidate.toLowerCase() === requested);
  if (locale) return locale;
  const primary = requested.split('-')[0];
  return LOCALES.find((candidate) => candidate.toLowerCase() === primary) ?? DEFAULT_LOCALE;
}

/**
 * 建立一个绑定语言的翻译函数。
 *
 * 查找顺序：目标语言 → 基准语言（zh）→ key 本身。后两级保证新增文案只写 zh 时
 * 其它语言也不会渲染出空白，也保证拼错的 key 在消息里可见而不是静默消失。
 * @param locale - 语言 id（可为地区形式，会先归一化）。
 * @returns `(key, params?) => string`。
 */
export function createTranslator(locale = DEFAULT_LOCALE) {
  const active = normalizeLocale(locale);
  const table = MESSAGES[active] ?? MESSAGES[DEFAULT_LOCALE];
  const fallback = MESSAGES[DEFAULT_LOCALE];
  return (key, params) => {
    const template = table[key] ?? fallback[key] ?? key;
    if (params === undefined) return template;
    return template.replace(PLACEHOLDER, (placeholder, name) =>
      Object.hasOwn(params, name) ? String(params[name]) : placeholder,
    );
  };
}

// 默认翻译器（基准语言）。渲染函数在未显式传入 translator 时使用它，
// 使卡片构造函数对既有调用点与测试保持向后兼容。
export const translate = createTranslator(DEFAULT_LOCALE);
