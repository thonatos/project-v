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
  return async (input, init) => {
    const next = { ...init, agent };
    // node-telegram-bot-api 的 multipart 上传会把请求体编码成 web 标准
    // ReadableStream（配合原生 fetch 的 duplex:'half' 流式发送）。node-fetch
    // 不支持这种 body，会发出空请求体导致 Telegram 返回空响应（EPARSE）。
    // 这里把流式 body 缓冲成 Buffer 再交给 node-fetch（媒体 <10MB，可接受）。
    if (next.body instanceof ReadableStream) {
      next.body = Buffer.from(await new Response(next.body).arrayBuffer());
    }
    // duplex 仅对原生 fetch 的流式 body 有意义，node-fetch 不识别。
    delete next.duplex;
    return nodeFetch(input, next);
  };
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
