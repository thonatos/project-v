import { Bot, InputFile } from 'node-telegram-bot-api';
import nodeFetch from 'node-fetch';
import { ProxyAgent } from 'proxy-agent';

export const TELEGRAM_MEDIA_LIMIT = 10 * 1024 * 1024;

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

export function createTelegramTransport(connection) {
  const { bot, botToken, fetchImpl } = connection;
  return {
    async sendText(chatId, text, { parseMode } = {}) {
      return bot.api.sendMessage({
        chat_id: chatId,
        text,
        ...(parseMode ? { parse_mode: parseMode } : {}),
      });
    },
    async editText(chatId, messageId, text, { parseMode } = {}) {
      return bot.api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text,
        ...(parseMode ? { parse_mode: parseMode } : {}),
      });
    },
    async editCard(chatId, messageId, replyMarkup) {
      return bot.api.editMessageReplyMarkup({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: replyMarkup,
      });
    },
    async sendCard(chatId, text, { replyMarkup, parseMode } = {}) {
      return bot.api.sendMessage({
        chat_id: chatId,
        text,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        ...(parseMode ? { parse_mode: parseMode } : {}),
      });
    },
    async answerCallback(callbackId, text) {
      return bot.api.answerCallbackQuery({
        callback_query_id: callbackId,
        ...(text ? { text } : {}),
      });
    },
    // 给指定消息设置/清除 emoji reaction。emoji 为空数组则清除。
    async setReaction(chatId, messageId, emoji) {
      return bot.api.setMessageReaction({
        chat_id: chatId,
        message_id: Number(messageId),
        reaction: emoji ? [{ type: 'emoji', emoji }] : [],
      });
    },
    async sendMedia(chatId, bytes, { kind = 'image', fileName = 'telegram-media', caption = '' } = {}) {
      const method = {
        image: 'sendPhoto',
        audio: 'sendAudio',
        video: 'sendVideo',
        document: 'sendDocument',
      }[kind];
      if (!method) throw new Error(`Unsupported Telegram media type: ${kind}`);
      const field = kind === 'image' ? 'photo' : kind;
      return bot.api[method]({
        chat_id: chatId,
        [field]: new InputFile(bytes, { filename: fileName }),
        ...(caption ? { caption } : {}),
      });
    },
    async downloadMedia(message) {
      const fileId = message.photo?.fileId ?? message.document?.fileId;
      if (!fileId) throw new Error('Telegram image has no file id');
      const file = await bot.api.getFile({ file_id: fileId });
      if (!file.file_path) throw new Error('Telegram image has no file path');
      const response = await fetchImpl(`https://api.telegram.org/file/bot${botToken}/${file.file_path}`);
      if (!response.ok) throw new Error(`Telegram image download failed (${response.status})`);
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > TELEGRAM_MEDIA_LIMIT) throw new Error('Telegram image exceeds the supported size limit');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength > TELEGRAM_MEDIA_LIMIT) throw new Error('Telegram image exceeds the supported size limit');
      return bytes;
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
    document: documentIsImage ? {
      fileId: message.document.file_id,
      file_name: message.document.file_name,
      mime_type: message.document.mime_type,
    } : undefined,
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
