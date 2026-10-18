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
  workspaceCard,
} from '../src/render/cards.js';
import {
  createProxyAgent,
  registerTelegramCommands,
  TELEGRAM_COMMANDS,
  TELEGRAM_COMMAND_NAMES,
  TELEGRAM_COMMAND_SCOPES,
} from '../src/transport/client.js';
import { extractLocalImagePaths } from '../src/render/local-images.js';
import { buildAgentSetup } from '../src/agent/integration.js';

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

test('creates a fixed agent for each configured proxy protocol', () => {
  const socks = createProxyAgent({ type: 'socks5', ip: 'proxy.example', port: 1080 });
  assert.equal(socks.constructor.name, 'SocksProxyAgent');
  assert.equal(socks.proxy.type, 5);
  assert.equal(socks.proxy.host, 'proxy.example');
  assert.equal(socks.proxy.port, 1080);
  assert.equal(createProxyAgent({ type: 'http', ip: 'proxy.example', port: 8080 }).constructor.name, 'HttpsProxyAgent');
  assert.equal(
    createProxyAgent({ type: 'https', ip: 'proxy.example', port: 8443 }).constructor.name,
    'HttpsProxyAgent',
  );
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
  const question = interactionCard({
    id: 'question-1',
    kind: 'question',
    payload: { questions: [{ question: '继续？', options: [{ label: '一个很长的中文选项' }] }] },
  });
  assert.equal(question.replyMarkup.inline_keyboard[0][0].callback_data, 'dsh:question:question-1:0');
  const status = statusCard({
    workspaceId: 'workspace-1',
    workspaceTitle: 'Main <repo>',
    sessionId: 'session-1',
    model: { provider: 'deepseek', model: 'deepseek-reasoner' },
    active: false,
    interactionPending: false,
  });
  assert.match(status.text, /Workspace.*workspace-1/);
  assert.match(status.text, /Main &lt;repo&gt;/);
  assert.match(status.text, /模型：<code>deepseek deepseek-reasoner<\/code>/);
  assert.match(status.text, /^<blockquote>/, '状态卡片应为 blockquote 面板');
  assert.match(status.text, /<\/blockquote>$/);
  assert.equal(status.parseMode, 'HTML');
  // 无选择时不得渲染空的 code 块。
  const noModel = statusCard({
    workspaceId: 'workspace-1',
    sessionId: 'session-1',
    active: false,
    interactionPending: false,
  });
  assert.match(noModel.text, /模型：未选择/);
  const help = controlCard('help', { message: '可用命令：', detail: '/new' });
  assert.match(help.text, /可用命令/);
  assert.match(help.text, /^<blockquote>/, '控制卡片应为 blockquote 面板');
  assert.equal(help.parseMode, 'HTML');
});

test('clears old commands before registering the supported command scopes', async () => {
  const calls = [];
  await registerTelegramCommands(
    {
      async deleteMyCommands(payload) {
        calls.push(['delete', payload]);
      },
      async setMyCommands(payload) {
        calls.push(['set', payload]);
      },
    },
    '456',
  );
  assert.deepEqual(calls, [
    ['delete', { scope: { type: 'chat', chat_id: '456' } }],
    ['delete', { scope: { type: 'default' } }],
    ...TELEGRAM_COMMAND_SCOPES.map((scope) => ['delete', { scope }]),
    ...TELEGRAM_COMMAND_SCOPES.map((scope) => ['set', { commands: TELEGRAM_COMMANDS, scope }]),
  ]);
  assert.deepEqual(TELEGRAM_COMMAND_SCOPES, [
    { type: 'all_private_chats' },
    { type: 'all_group_chats' },
    { type: 'all_chat_administrators' },
  ]);
  assert.deepEqual(
    TELEGRAM_COMMANDS.map(({ command }) => command),
    ['new', 'stop', 'help', 'model', 'status', 'workspace'],
  );
  // 命令按名称长度升序，最长的 /workspace 落在末尾：短命令在前更易扫读。
  const lengths = TELEGRAM_COMMANDS.map(({ command }) => command.length);
  assert.deepEqual(
    lengths,
    [...lengths].sort((a, b) => a - b),
    '命令须按名称长度升序',
  );
  assert.equal(TELEGRAM_COMMANDS.at(-1).command, 'workspace');
  // 名称列表由同一来源派生，顺序一致——避免菜单、/help、错误提示三处各维护一份。
  assert.deepEqual(
    TELEGRAM_COMMAND_NAMES,
    TELEGRAM_COMMANDS.map(({ command }) => `/${command}`),
  );
  // 每个命令都必须有描述，否则 Telegram 菜单里会显示空白项。
  for (const { command, description } of TELEGRAM_COMMANDS) {
    assert.ok(description?.trim(), `${command} 缺少描述`);
  }
});

test('renders a workspace selector with the current workspace marked', () => {
  const card = workspaceCard(
    [
      { id: 'workspace-1', title: 'Main <repo>' },
      { id: 'workspace-2', title: 'Docs' },
    ],
    'workspace-1',
  );
  assert.equal(card.parseMode, 'HTML');
  assert.match(card.text, /Main &lt;repo&gt;/);
  assert.match(card.text, /●.*workspace-1/);
  assert.deepEqual(card.replyMarkup.inline_keyboard, [
    [{ text: '✓ Main <repo>', callback_data: 'dsh:workspace:select:workspace-1' }],
    [{ text: 'Docs', callback_data: 'dsh:workspace:select:workspace-2' }],
  ]);
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

test('extracts explicit local image markup; skips file references, remote URLs and non-images', () => {
  const text = [
    'markdown 图 ![out](./out/chart.png)',
    '富链接 [下载图片](solid-color.png)',
    '反引号 `/abs/solid.png` 只是文件引用',
    '裸路径 路径：/Users/me/ws/pic.JPEG 也只是文件引用',
    '远程图 ![r](https://example.com/a.png) 不读盘',
    'data 图 ![d](data:image/png;base64,AAAA) 跳过',
    '非图片 `./notes.txt` 跳过',
    '重复 ![dup](./out/chart.png) 去重',
  ].join('\n');
  const paths = extractLocalImagePaths(text);
  assert.deepEqual(paths, ['./out/chart.png', 'solid-color.png']);
});

test('decodes percent-encoded local image paths', () => {
  assert.deepEqual(extractLocalImagePaths('![x](./my%20dir/a.png)'), ['./my dir/a.png']);
});

test('installs the Telegram question and approval bridges after preset handlers', async () => {
  const approvalHandlers = [];
  const questionHandlers = [];
  const agentCtx = {
    on(name, handler, options = {}) {
      const handlers = name === 'approval/request' ? approvalHandlers : questionHandlers;
      handlers[options.prepend ? 'unshift' : 'push'](handler);
    },
  };
  const setup = buildAgentSetup({
    async mountPreset(ctx) {
      ctx.on('approval/request', () => 'web', { prepend: true });
      ctx.on('user-questions/request', () => 'web', { prepend: true });
    },
    onUserQuestionsRequested: () => 'telegram-question',
    onApprovalRequested: () => 'telegram',
  });

  await setup(agentCtx);

  assert.equal(approvalHandlers[0]({}), 'telegram');
  assert.equal(approvalHandlers[1]({}), 'web');
  assert.equal(questionHandlers[0]({}), 'telegram-question');
  assert.equal(questionHandlers[1]({}), 'web');
});
