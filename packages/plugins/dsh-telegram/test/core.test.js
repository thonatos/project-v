import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, resolveCredentials } from '../src/config.js';
import { normalizeInboundMessage, splitMessageText, StreamRenderer } from '../src/message.js';
import { SessionStore } from '../src/session-store.js';
import { createTelegramTransport, TELEGRAM_MEDIA_LIMIT } from '../src/telegram-client.js';
import { classifyContent, controlCard, interactionCard, statusCard, toolCardText } from '../src/outbound.js';

test('normalizes the owner-bound Telegram config', () => {
  const config = normalizeConfig({
    ownerUserId: '456',
    workspaceId: 'workspace-1',
    messageLimit: 100,
  });
  assert.equal(config.ownerUserId, '456');
  assert.equal(config.messageLimit, 100);
});

test('rejects unsafe message limits and missing owner', () => {
  assert.throws(() => normalizeConfig({ workspaceId: 'w', messageLimit: 4097 }), /messageLimit/);
  assert.throws(() => normalizeConfig({ workspaceId: 'w', messageLimit: 10 }), /ownerUserId/);
});

test('normalizes proxy and never returns the bot token from config', async () => {
  const config = normalizeConfig({
    ownerUserId: '456',
    workspaceId: 'workspace-1',
    messageLimit: 4096,
    proxy: { type: 'https', ip: 'proxy.example', port: 8443, username: 'user', password: 'secret' },
  });
  assert.deepEqual(config.proxy, {
    type: 'https',
    ip: 'proxy.example',
    port: 8443,
    username: 'user',
    password: 'secret',
  });
  assert.equal('botToken' in config, false);
  assert.deepEqual(await resolveCredentials({ resolve: async () => ({ value: 'token' }) }), { botToken: 'token' });
});

test('splits text without breaking surrogate pairs', () => {
  const chunks = splitMessageText(`abcd😀efgh`, 5);
  assert.ok(chunks.every((chunk) => chunk.length <= 5));
  assert.equal(chunks.join(''), 'abcd😀efgh');
  assert.ok(chunks.every((chunk) => !chunk.includes('\ud800') && !chunk.includes('\udc00')));
});

test('maps outbound content to native Telegram delivery types', () => {
  const events = classifyContent([
    { type: 'text', text: 'hello' },
    { type: 'image', attachment: { id: 'image-1' } },
    { type: 'tool_update', toolName: 'search', status: '执行中' },
    { type: 'approval', payload: { prompt: '继续？' } },
  ]);
  assert.deepEqual(
    events.map((event) => event.type),
    ['text', 'media', 'tool', 'interaction'],
  );
  assert.equal(events[1].kind, 'image');
  assert.match(toolCardText(events[2].block), /search/);
  const card = interactionCard({ id: 'approval-1', kind: 'approval', payload: { prompt: '继续？' } });
  assert.equal(card.replyMarkup.inline_keyboard[0][0].callback_data, 'dsh:approval:approval-1:approve');
  const status = statusCard({
    workspaceId: 'workspace-1',
    sessionId: 'session-1',
    active: false,
    interactionPending: false,
  });
  assert.match(status.text, /Workspace.*workspace-1/);
  assert.equal(status.parseMode, 'HTML');
  const help = controlCard('help', { message: '可用命令：', detail: '/new' });
  assert.match(help.text, /可用命令/);
  assert.equal(help.parseMode, 'HTML');
});

test('keeps media and caption as one inbound message', async () => {
  const inbound = normalizeInboundMessage(
    {
      message: 'look',
      photo: { fileName: 'image.jpg' },
    },
    { loadMedia: async () => Buffer.from('image') },
  );
  assert.equal(inbound.text, 'look');
  assert.equal(inbound.media.kind, 'image');
  assert.deepEqual(await inbound.media.load(), Buffer.from('image'));
});

test('persists session bindings atomically', async () => {
  const path = new URL('./fixtures/session-bindings.json', import.meta.url).pathname;
  const store = await new SessionStore(path).load();
  await store.set('123', { sessionId: 'session-1', workspaceId: 'workspace-1' });
  const loaded = await new SessionStore(path).load();
  assert.deepEqual(loaded.get('123'), { sessionId: 'session-1', workspaceId: 'workspace-1' });
  await loaded.remove();
});

test('sends text through the Bot API transport and rejects oversized media', async () => {
  const sent = [];
  const edited = [];
  const answered = [];
  const transport = createTelegramTransport({
    botToken: 'token',
    fetchImpl: async () => ({
      ok: true,
      headers: new Map([['content-length', String(TELEGRAM_MEDIA_LIMIT + 1)]]),
      async arrayBuffer() {
        return new ArrayBuffer(0);
      },
    }),
    bot: {
      api: {
        async sendMessage(value) {
          sent.push(value);
        },
        async editMessageText(value) {
          edited.push(['text', value]);
        },
        async editMessageReplyMarkup(value) {
          edited.push(['card', value]);
        },
        async answerCallbackQuery(value) {
          answered.push(value);
        },
        async sendPhoto(value) {
          sent.push(value);
        },
        async getFile() {
          return { file_path: 'image.jpg' };
        },
      },
    },
  });
  await transport.sendText('7', 'hello');
  assert.deepEqual(sent, [{ chat_id: '7', text: 'hello' }]);
  await transport.sendCard('7', 'Approve?', {
    replyMarkup: { inline_keyboard: [[{ text: 'Yes', callback_data: 'yes' }]] },
  });
  await transport.editText('7', '12', 'updated');
  await transport.editCard('7', '12', { inline_keyboard: [] });
  await transport.answerCallback('callback-1', 'Done');
  assert.deepEqual(sent[1], {
    chat_id: '7',
    text: 'Approve?',
    reply_markup: { inline_keyboard: [[{ text: 'Yes', callback_data: 'yes' }]] },
  });
  assert.deepEqual(edited, [
    ['text', { chat_id: '7', message_id: '12', text: 'updated' }],
    ['card', { chat_id: '7', message_id: '12', reply_markup: { inline_keyboard: [] } }],
  ]);
  assert.deepEqual(answered, [{ callback_query_id: 'callback-1', text: 'Done' }]);
  await assert.rejects(() => transport.downloadMedia({ photo: { fileId: 'file-1' } }), /size limit/);
});

test('streams text by editing the last message and splitting on overflow', async () => {
  const sent = [];
  const edited = [];
  let id = 0;
  const renderer = new StreamRenderer({
    limit: 5,
    send: async (part) => {
      sent.push(part);
      return ++id;
    },
    edit: async (messageId, part) => {
      edited.push([messageId, part]);
    },
  });
  await renderer.update('ab');
  await renderer.update('abc');
  assert.deepEqual(sent, ['ab']);
  assert.deepEqual(edited, [['1', 'abc']]);
  await renderer.update('abcdefg');
  // 第一片定稿为 'abcde'（编辑最后一条），溢出部分作为新消息发送
  assert.deepEqual(edited.at(-1), ['1', 'abcde']);
  assert.deepEqual(sent, ['ab', 'fg']);
  assert.deepEqual(renderer.messageIds, ['1', '2']);
});

test('stream renderer falls back to a new message when editing fails', async () => {
  const sent = [];
  let id = 0;
  const renderer = new StreamRenderer({
    limit: 100,
    send: async (part) => {
      sent.push(part);
      return ++id;
    },
    edit: async () => {
      throw new Error("message can't be edited");
    },
  });
  await renderer.update('hello');
  await renderer.update('hello world');
  assert.deepEqual(sent, ['hello', 'hello world']);
  assert.deepEqual(renderer.messageIds, ['2']);
});

test('rejects invalid stream renderer configuration', () => {
  assert.throws(() => new StreamRenderer({ limit: 0, send() {}, edit() {} }), /positive limit/);
  assert.throws(() => new StreamRenderer({ limit: 5 }), /send and edit/);
});
