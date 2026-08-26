import { InputFile } from 'node-telegram-bot-api';

export const TELEGRAM_MEDIA_LIMIT = 10 * 1024 * 1024;

// 把一个已建立的连接（{ bot, botToken, fetchImpl }）封装为出站 API 方法集合。
// 只负责调用 Bot API，不关心 polling/连接生命周期（后者归 client.js）。
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
    // 给指定消息设置/清除 emoji reaction。emoji 为空则清除。
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
