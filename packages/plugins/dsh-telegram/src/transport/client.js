import { Bot } from 'node-telegram-bot-api';
import nodeFetch from 'node-fetch';
import { ProxyAgent } from 'proxy-agent';

// 命令清单的唯一来源：Telegram 命令菜单、/help 与「不支持的命令」提示都由它派生，
// 避免像过去那样在三处各维护一份（加 /model 时就得同时改三个地方）。
// 顺序按命令名长度升序，同长度保持下方声明顺序（Array.sort 自 ES2019 起保证稳定）：
// 短命令在前更易扫读，最长的 /workspace 自然落到末尾。
const COMMAND_DEFINITIONS = [
  { command: 'new', description: '新建会话' },
  { command: 'status', description: '查看当前状态' },
  { command: 'stop', description: '停止当前任务' },
  { command: 'help', description: '查看帮助' },
  { command: 'workspace', description: '选择或切换 Workspace' },
  { command: 'model', description: '查看或切换模型' },
];

export const TELEGRAM_COMMANDS = [...COMMAND_DEFINITIONS].sort((a, b) => a.command.length - b.command.length);

// `/new`、`/stop` … 形式的命令名列表，供帮助与错误提示复用，顺序同上。
export const TELEGRAM_COMMAND_NAMES = TELEGRAM_COMMANDS.map(({ command }) => `/${command}`);

export const TELEGRAM_COMMAND_SCOPES = [
  { type: 'all_private_chats' },
  { type: 'all_group_chats' },
  { type: 'all_chat_administrators' },
];

export async function registerTelegramCommands(api, ownerUserId) {
  // 清除旧版本使用的 Owner chat scope，避免它以更高优先级覆盖私聊 scope。
  await api.deleteMyCommands({ scope: { type: 'chat', chat_id: ownerUserId } });
  // BotFather 和旧脚本通常写入 default；它会回退显示，必须一并清除但不重新注册。
  await api.deleteMyCommands({ scope: { type: 'default' } });
  for (const scope of TELEGRAM_COMMAND_SCOPES) await api.deleteMyCommands({ scope });
  for (const scope of TELEGRAM_COMMAND_SCOPES) {
    await api.setMyCommands({ commands: TELEGRAM_COMMANDS, scope });
  }
}

// 建立 Telegram Bot 连接：校验无 webhook、注册事件处理器、启动 long polling。
// 返回连接句柄（{ bot, botId, botToken, fetchImpl, close }），出站方法封装见 transport.js。
export async function createTelegramClient({ botToken, ownerUserId, proxy, onMessage, onCallbackQuery }) {
  const fetchImpl = createFetch(proxy);
  const bot = new Bot(botToken, fetchImpl ? { fetch: fetchImpl } : {});
  const me = await bot.api.getMe();
  const webhook = await bot.api.getWebhookInfo();
  if (webhook.url) throw new Error('Telegram Bot 已配置 Webhook，无法同时启用 long polling');
  await registerTelegramCommands(bot.api, ownerUserId);

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
