import { Bot } from 'node-telegram-bot-api';
import nodeFetch from 'node-fetch';
import { ProxyAgent } from 'proxy-agent';

// 建立 Telegram Bot 连接：校验无 webhook、注册事件处理器、启动 long polling。
// 返回连接句柄（{ bot, botId, botToken, fetchImpl, close }），出站方法封装见 transport.js。
export async function createTelegramClient({ botToken, proxy, onMessage, onCallbackQuery }) {
  const fetchImpl = createFetch(proxy);
  const bot = new Bot(botToken, fetchImpl ? { fetch: fetchImpl } : {});
  const me = await bot.api.getMe();
  const webhook = await bot.api.getWebhookInfo();
  if (webhook.url) throw new Error('Telegram Bot 已配置 Webhook，无法同时启用 long polling');

  if (onMessage) bot.on('message', (ctx) => onMessage({ message: normalizeMessage(ctx.message) }));
  if (onCallbackQuery) {
    bot.on('callback_query', (ctx) => onCallbackQuery({ callback: normalizeCallback(ctx.callbackQuery) }));
  }
  const polling = bot.startPolling(undefined, {
    timeout: 25,
    allowedUpdates: ['message', 'callback_query'],
    retry: true,
  });

  return {
    bot,
    botId: String(me.id),
    botToken,
    fetchImpl: fetchImpl ?? fetch,
    async close() {
      bot.stop();
      await polling;
    },
  };
}

function createFetch(proxy) {
  if (!proxy) return undefined;
  const url = new URL(`${proxy.type ?? 'socks5'}://localhost`);
  url.hostname = proxy.ip;
  url.port = String(proxy.port);
  if (proxy.username) url.username = proxy.username;
  if (proxy.password) url.password = proxy.password;
  const agent = new ProxyAgent(url);
  return (input, init) => nodeFetch(input, { ...init, agent });
}

function normalizeMessage(message) {
  const photo = message.photo?.at(-1);
  const documentIsImage = message.document?.mime_type?.startsWith('image/');
  return {
    isPrivate: message.chat?.type === 'private',
    senderId: String(message.from?.id ?? ''),
    chatId: String(message.chat?.id ?? ''),
    messageId: String(message.message_id ?? ''),
    message: message.text ?? message.caption ?? '',
    photo: photo ? { fileId: photo.file_id } : undefined,
    document: documentIsImage
      ? {
          fileId: message.document.file_id,
          file_name: message.document.file_name,
          mime_type: message.document.mime_type,
        }
      : undefined,
  };
}

function normalizeCallback(callback) {
  return {
    id: String(callback?.id ?? ''),
    data: String(callback?.data ?? ''),
    messageId: String(callback?.message?.message_id ?? ''),
    chatId: String(callback?.message?.chat?.id ?? callback?.from?.id ?? ''),
    senderId: String(callback?.from?.id ?? ''),
  };
}
