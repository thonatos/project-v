import Schema from '@deepseek-ai/schemastery';

export const SETTINGS_NAMESPACE = 'dsh-telegram';
export const TELEGRAM_MESSAGE_LIMIT = 4096;
export const BOT_TOKEN_REF = 'DSH_TELEGRAM_BOT_TOKEN';

export const Config = Schema.object({
  enabled: Schema.boolean().default(false),
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
  if (!Number.isSafeInteger(config.messageLimit)
    || config.messageLimit < 1 || config.messageLimit > TELEGRAM_MESSAGE_LIMIT) {
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
    type: value.type ?? 'socks5', ip: value.ip.trim(), port: value.port,
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
