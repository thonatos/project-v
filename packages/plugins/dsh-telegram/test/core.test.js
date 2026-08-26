import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, resolveCredentials } from '../src/config.js';
import { normalizeInboundMessage, splitMessageText } from '../src/transport/inbound.js';
import { StreamRenderer } from '../src/render/renderer.js';
import { createTelegramTransport, TELEGRAM_MEDIA_LIMIT } from '../src/transport/transport.js';
import {
  approvalCard,
  classifyContent,
  controlCard,
  interactionCard,
  statusCard,
  toolCardText,
} from '../src/render/cards.js';
import { extractLocalImagePaths } from '../src/render/local-images.js';

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
  assert.match(status.text, /^<blockquote>/, '状态卡片应为 blockquote 面板');
  assert.match(status.text, /<\/blockquote>$/);
  assert.equal(status.parseMode, 'HTML');
  const help = controlCard('help', { message: '可用命令：', detail: '/new' });
  assert.match(help.text, /可用命令/);
  assert.match(help.text, /^<blockquote>/, '控制卡片应为 blockquote 面板');
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

test('renders an approval card as a blockquote panel with approve/reject buttons', () => {
  const card = approvalCard('req-1', { toolName: 'bash', reason: '删除文件 <x>' });
  assert.equal(card.parseMode, 'HTML');
  assert.match(card.text, /^<blockquote>/, '审批卡片应为 blockquote 面板');
  assert.match(card.text, /审批请求/);
  assert.match(card.text, /bash/);
  // 动态值转义：reason 里的 < > 不得原样出现
  assert.match(card.text, /删除文件 &lt;x&gt;/);
  const [approve, reject] = card.replyMarkup.inline_keyboard[0];
  assert.equal(approve.callback_data, 'dsh:approval:req-1:approve');
  assert.equal(reject.callback_data, 'dsh:approval:req-1:reject');
});

test('extracts local image paths from markdown, inline-code and bare forms; skips remote and non-images', () => {
  const text = [
    'markdown 图 ![out](./out/chart.png)',
    '反引号 `/abs/solid.png` 也认',
    '裸路径 路径：/Users/me/ws/pic.JPEG',
    '远程图 ![r](https://example.com/a.png) 不读盘',
    'data 图 ![d](data:image/png;base64,AAAA) 跳过',
    '非图片 `./notes.txt` 跳过',
    '重复 ![dup](./out/chart.png) 去重',
  ].join('\n');
  const paths = extractLocalImagePaths(text);
  assert.deepEqual(paths, ['./out/chart.png', '/abs/solid.png', '/Users/me/ws/pic.JPEG']);
});

test('decodes percent-encoded local image paths', () => {
  assert.deepEqual(extractLocalImagePaths('![x](./my%20dir/a.png)'), ['./my dir/a.png']);
});
