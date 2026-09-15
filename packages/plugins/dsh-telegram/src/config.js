import Schema from '@deepseek-ai/schemastery';
import { DEFAULT_LOCALE, LOCALES, normalizeLocale } from './i18n/index.js';

export const SETTINGS_NAMESPACE = 'dsh-telegram';
export const TELEGRAM_MESSAGE_LIMIT = 4096;
export const BOT_TOKEN_REF = 'DSH_TELEGRAM_BOT_TOKEN';

export const Config = Schema.object({
  enabled: Schema.boolean().default(false),
  // 聊天文案语言。默认 zh 与本地化之前的行为一致（既有部署升级后观感不变）。
  language: Schema.union([...LOCALES]).default(DEFAULT_LOCALE),
  workspaceId: Schema.string().default(''),
  ownerUserId: Schema.string().default(''),
  messageLimit: Schema.number().default(TELEGRAM_MESSAGE_LIMIT),
  proxy: Schema.object({
    type: Schema.union(['socks5', 'http', 'https']).default('socks5'),
    ip: Schema.string().default(''),
    port: Schema.number().default(0),
    username: Schema.string().default(''),
    password: Schema.string().default(''),
  }).default({}),
});

export function normalizeConfig(value = {}) {
  const config = { ...value };
  if (
    !Number.isSafeInteger(config.messageLimit) ||
    config.messageLimit < 1 ||
    config.messageLimit > TELEGRAM_MESSAGE_LIMIT
  ) {
    throw new TypeError(`Telegram messageLimit must be between 1 and ${TELEGRAM_MESSAGE_LIMIT}`);
  }
  if (typeof config.workspaceId !== 'string' || !config.workspaceId.trim()) {
    throw new TypeError('Telegram workspaceId is required');
  }
  if (!/^[1-9]\d{0,15}$/.test(String(config.ownerUserId ?? '').trim())) {
    throw new TypeError('Telegram ownerUserId must be a numeric Telegram User ID');
  }
  const proxy = normalizeProxy(config.proxy);
  return Object.freeze({
    enabled: Boolean(config.enabled),
    // 未知/缺省语言归一化到默认语言；地区形式（zh-CN、ru-RU）按主语言收敛。
    language: normalizeLocale(config.language),
    workspaceId: config.workspaceId.trim(),
    ownerUserId: String(config.ownerUserId).trim(),
    messageLimit: config.messageLimit,
    proxy,
  });
}

function normalizeProxy(value = {}) {
  if (!value || typeof value !== 'object') throw new TypeError('Telegram proxy must be an object');
  const hasProxy = Boolean(value.ip || value.port);
  if (!hasProxy) return undefined;
  if (!['socks5', 'http', 'https'].includes(value.type ?? 'socks5')) {
    throw new TypeError('Telegram proxy type is invalid');
  }
  if (typeof value.ip !== 'string' || !value.ip.trim()) throw new TypeError('Telegram proxy ip is required');
  if (!Number.isSafeInteger(value.port) || value.port < 1 || value.port > 65535) {
    throw new TypeError('Telegram proxy port is invalid');
  }
  return Object.freeze({
    type: value.type ?? 'socks5',
    ip: value.ip.trim(),
    port: value.port,
    ...(value.username ? { username: value.username } : {}),
    ...(value.password ? { password: value.password } : {}),
  });
}

export async function resolveCredentials(credentials) {
  if (!credentials?.resolve) throw new TypeError('dsh credentials service is required');
  const botToken = await credentials.resolve(BOT_TOKEN_REF);
  if (!botToken?.value) throw new Error('Telegram Bot Token credential is required');
  return { botToken: botToken.value };
}
