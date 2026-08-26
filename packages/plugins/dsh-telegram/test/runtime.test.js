import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TelegramRuntime, userFacingError } from '../src/runtime.js';

// 内存版绑定存储：替代 openBindingStore，避免测试触碰真实文件或 storage backend。
function memoryOpenStore() {
  const rows = new Map();
  return async () => ({
    get: (key) => rows.get(String(key)) ?? null,
    async set(key, binding) {
      rows.set(String(key), { sessionId: binding.sessionId, workspaceId: binding.workspaceId });
    },
    async delete(key) {
      rows.delete(String(key));
    },
    async close() {},
  });
}

test('maps errors to redacted user-facing messages without leaking details', () => {
  assert.match(userFacingError({ code: 429 }), /过于频繁/);
  assert.match(userFacingError(new Error('Too Many Requests: flood')), /过于频繁/);
  assert.match(userFacingError(new Error('Telegram image exceeds the supported size limit')), /媒体处理失败/);
  assert.match(userFacingError(new Error("Bad Request: message can't be edited")), /消息更新失败/);
  assert.match(userFacingError(new Error('interaction expired')), /交互已失效/);
  assert.match(userFacingError({ status: 403, message: 'Forbidden: bot was blocked' }), /服务返回错误/);
  assert.match(userFacingError(new Error('some internal token=abc123 stack trace')), /消息处理失败/);
  // 脱敏保证：不回显原始 secret 或堆栈
  assert.doesNotMatch(userFacingError(new Error('token=abc123')), /abc123/);
});

test('routes only owner messages into the bound workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-telegram-'));
  const workspace = {
    path: root,
    async status() {
      return 'ok';
    },
    async attachSession() {},
  };
  const followups = [];
  const sentMessages = [];
  const cards = [];
  const editedCards = [];
  const editedTexts = [];
  const createOptions = [];
  const setupHandlers = new Map();
  let incoming;
  let nextId = 0;
  let sentId = 0;
  let resolveIdle;
  let longRunning = false;
  const cancellations = [];
  const pendingIdle = new Promise((resolve) => {
    resolveIdle = resolve;
  });
  const ctx = {
    credentials: {
      async resolve(ref) {
        return { value: `${ref}-value`, source: 'test' };
      },
    },
    workspaceRegistry: {
      get() {
        return workspace;
      },
    },
    agentDefaultModel: {
      currentSelection() {
        return { provider: 'deepseek', model: 'deepseek-chat' };
      },
    },
    agents: {
      async create(options) {
        createOptions.push(options);
        options.setup?.({
          on(event, handler) {
            setupHandlers.set(event, handler);
            return () => setupHandlers.delete(event);
          },
        });
        const id = options.sessionId ?? `session-${++nextId}`;
        const agent = {
          id,
          session: { header: { cwd: root } },
          get status() {
            return longRunning ? 'running' : 'idle';
          },
          followup(message) {
            followups.push(message);
            longRunning = message.content?.[0]?.text === 'long';
          },
          whenIdle() {
            return longRunning ? pendingIdle : Promise.resolve();
          },
          cancel(...args) {
            cancellations.push(args);
          },
        };
        return { agent, async dispose() {} };
      },
      async resume() {
        throw new Error('not expected');
      },
    },
    on() {},
    effect() {},
  };
  const runtime = new TelegramRuntime(
    ctx,
    {
      ownerUserId: '7',
      workspaceId: 'workspace-1',
      messageLimit: 100,
    },
    {
      openStore: memoryOpenStore(),
      async createClient(options) {
        incoming = options.onMessage;
        return {
          botId: '99',
          bot: {
            api: {
              async sendMessage(payload) {
                sentMessages.push(payload);
                return { message_id: payload.reply_markup ? 42 : ++sentId };
              },
              async editMessageText(payload) {
                editedTexts.push(payload);
              },
              async editMessageReplyMarkup(payload) {
                editedCards.push(payload);
              },
              async answerCallbackQuery() {},
              async sendCard(payload) {
                cards.push(payload);
                return { message_id: 42 };
              },
              async sendPhoto() {},
            },
          },
          botToken: 'token',
          fetchImpl: fetch,
          async close() {},
        };
      },
    },
  );
  await runtime.start();
  await incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', message: '/status' } });
  await runtime.whenSettled('7');
  assert.equal(createOptions.length, 1);
  assert.match(createOptions[0].sessionId, /^telegram-/);
  assert.deepEqual(createOptions[0].agentOptions, {
    provider: 'deepseek',
    model: 'deepseek-chat',
  });
  assert.equal(typeof createOptions[0].setup, 'function');
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Telegram 状态/);
  assert.equal(sentMessages[0].reply_markup, undefined);
  assert.equal(sentMessages[0].parse_mode, 'HTML');
  assert.match(sentMessages[0].text, /Workspace/);
  assert.equal(followups.length, 0);
  await incoming({ message: { isPrivate: true, senderId: '8', message: 'ignored' } });
  assert.equal(followups.length, 0);
  let interactionAnswer;
  await setupHandlers.get('interaction/requested')({
    id: 'question-1',
    kind: 'question',
    payload: { question: '继续？', options: [{ label: '是', value: 'yes' }] },
    respond(answer) {
      interactionAnswer = answer;
    },
  });
  assert.equal(sentMessages.at(-1).text, '继续？');
  await incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', message: 'yes' } });
  await runtime.whenSettled('7');
  assert.deepEqual(interactionAnswer, { kind: 'text', value: 'yes' });
  assert.deepEqual(editedCards.at(-1), { chat_id: '7', message_id: '42', reply_markup: { inline_keyboard: [] } });
  await incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', message: 'hello' } });
  await runtime.whenSettled('7');
  assert.equal(followups.length, 1);
  assert.deepEqual(followups[0].content, [{ type: 'text', text: 'hello' }]);
  assert.equal(followups[0].source.kind, 'user');
  assert.match(followups[0].source.rpcId, /^telegram-/);
  assert.equal(createOptions[0].meta.cwd, root);
  const long = incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', message: 'long' } });
  await new Promise((resolve) => setImmediate(resolve));
  const stop = incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', message: '/stop' } });
  await stop;
  assert.match(sentMessages.at(-1).text, /已请求停止当前任务/);
  assert.equal(cancellations.length, 1);
  assert.deepEqual(cancellations[0][0], { kind: 'user' });
  assert.deepEqual(cancellations[0][1], { keepInbox: true });
  resolveIdle();
  await long;
  await runtime.stop();
  await rm(root, { recursive: true, force: true });
});

test('streams the assistant reply and rejects foreign callback queries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-telegram-'));
  const workspace = {
    path: root,
    async status() {
      return 'ok';
    },
    async attachSession() {},
  };
  const sent = [];
  const answered = [];
  let incoming;
  let onCallback;
  let sentId = 0;
  let sessionEvent;
  const ctx = {
    credentials: {
      async resolve(ref) {
        return { value: `${ref}-value` };
      },
    },
    workspaceRegistry: {
      get() {
        return workspace;
      },
    },
    agentDefaultModel: {
      currentSelection() {
        return { provider: 'deepseek', model: 'deepseek-chat' };
      },
    },
    agents: {
      async create(options) {
        const handlers = new Map();
        options.setup?.({
          on(event, handler) {
            handlers.set(event, handler);
            return () => handlers.delete(event);
          },
        });
        sessionEvent = (event) => handlers.get('session/event')?.({}, event);
        const agent = {
          id: options.sessionId,
          session: {
            header: { cwd: root },
            deriveMessages() {
              return [];
            },
          },
          // 提交 prompt 时同步 emit 增量文本事件，模拟 Harness 流式输出。
          followup() {
            sessionEvent({
              type: 'assistant/chunk',
              data: { chunk: { type: 'text-delta', index: 0, text: 'answer ' } },
            });
            sessionEvent({ type: 'assistant/chunk', data: { chunk: { type: 'text-delta', index: 0, text: 'body' } } });
          },
          whenIdle() {
            return Promise.resolve();
          },
          cancel() {},
        };
        return { agent, async dispose() {} };
      },
      async resume() {
        throw new Error('not expected');
      },
    },
    on() {},
    effect() {},
  };
  const runtime = new TelegramRuntime(
    ctx,
    {
      ownerUserId: '7',
      workspaceId: 'workspace-1',
      messageLimit: 6,
    },
    {
      openStore: memoryOpenStore(),
      async createClient(options) {
        incoming = options.onMessage;
        onCallback = options.onCallbackQuery;
        return {
          botId: '99',
          botToken: 'token',
          fetchImpl: fetch,
          bot: {
            api: {
              async sendMessage(payload) {
                sent.push(payload);
                return { message_id: ++sentId };
              },
              async editMessageText(payload) {
                sent.push(payload);
              },
              async editMessageReplyMarkup() {},
              async answerCallbackQuery(payload) {
                answered.push(payload);
              },
              async sendPhoto() {},
            },
          },
          async close() {},
        };
      },
    },
  );
  await runtime.start();
  // 普通消息触发流式增量输出：messageLimit=6，'answer body' 会被安全分片为多条
  await incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', message: 'hi' } });
  await runtime.whenSettled('7');
  // 流式期间既有 sendMessage（首片）也有 editMessageText（增长编辑），合并后应还原全文
  const textParts = sent.filter((payload) => typeof payload.text === 'string' && !payload.reply_markup);
  assert.ok(textParts.length >= 1);
  assert.equal(
    textParts
      .map((payload) => payload.text)
      .join('')
      .replace(/\s+/g, '')
      .includes('answer'),
    true,
  );
  assert.ok(textParts.every((payload) => payload.text.length <= 6));
  // 陌生用户的 callback 被脱敏拒绝，不改动任何 interaction
  await onCallback({ callback: { id: 'cb-1', senderId: '999', chatId: '7', data: 'dsh:approval:x:approve' } });
  assert.equal(answered.length, 0);
  // owner 的过期 callback 返回失效提示
  await onCallback({ callback: { id: 'cb-2', senderId: '7', chatId: '7', data: 'dsh:approval:missing:approve' } });
  assert.match(answered.at(-1).text, /失效|已被处理/);
  await runtime.stop();
  await rm(root, { recursive: true, force: true });
});

test('agentOptions on create and resume equal the currentSelection snapshot', async () => {
  // 契约锁定：provider/model 一致性由 create/resume 两侧统一传入的 agentOptions 保证，
  // 而非曾经的 installModelSelection 双 waterfall 内联复刻。两侧都必须带上 currentSelection 快照，
  // 否则 DeepSeek 适配器会因 provider/model 漂移把工具调用裸写成 <｜｜DSML｜｜...> 文本。
  const root = await mkdtemp(join(tmpdir(), 'dsh-telegram-sel-'));
  const workspace = {
    path: root,
    async status() {
      return 'ok';
    },
    async attachSession() {},
  };
  const createOptions = [];
  const resumeOptions = [];
  const selection = { provider: 'deepseek', model: 'deepseek-chat' };
  // 预置绑定 → 首条消息走 resume；随后删除该会话使下一条消息走 create。
  const rows = new Map([['7', { sessionId: 'telegram-existing', workspaceId: 'workspace-1' }]]);
  const store = {
    get: (key) => rows.get(String(key)) ?? null,
    async set(key, binding) {
      rows.set(String(key), { sessionId: binding.sessionId, workspaceId: binding.workspaceId });
    },
    async delete(key) {
      rows.delete(String(key));
    },
    async close() {},
  };
  let incoming;
  const makeAgent = (id) => ({
    id,
    session: { header: { cwd: root } },
    get status() {
      return 'idle';
    },
    followup() {},
    whenIdle() {
      return Promise.resolve();
    },
    cancel() {},
  });
  const ctx = {
    credentials: {
      async resolve(ref) {
        return { value: `${ref}-value` };
      },
    },
    workspaceRegistry: {
      get() {
        return workspace;
      },
    },
    agentDefaultModel: {
      currentSelection() {
        return { ...selection };
      },
    },
    agents: {
      async create(options) {
        createOptions.push(options);
        await options.setup?.({
          on() {
            return () => {};
          },
        });
        return { agent: makeAgent(options.sessionId), async dispose() {} };
      },
      async resume(options) {
        resumeOptions.push(options);
        await options.setup?.({
          on() {
            return () => {};
          },
        });
        return { agent: makeAgent(options.resumeSessionId), async dispose() {} };
      },
    },
    on() {},
    effect() {},
  };
  const runtime = new TelegramRuntime(
    ctx,
    {
      ownerUserId: '7',
      workspaceId: 'workspace-1',
      messageLimit: 100,
    },
    {
      openStore: async () => store,
      async createClient(options) {
        incoming = options.onMessage;
        return {
          botId: '99',
          bot: {
            api: {
              async sendMessage() {
                return { message_id: 1 };
              },
              async editMessageText() {},
              async editMessageReplyMarkup() {},
              async answerCallbackQuery() {},
              async sendPhoto() {},
            },
          },
          botToken: 'token',
          fetchImpl: fetch,
          async close() {},
        };
      },
    },
  );
  await runtime.start();
  // 首条消息：命中预置绑定 → resume，agentOptions 必须等于快照
  await incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', message: '/status' } });
  await runtime.whenSettled('7');
  assert.equal(resumeOptions.length, 1);
  assert.equal(resumeOptions[0].resumeSessionId, 'telegram-existing');
  assert.deepEqual(resumeOptions[0].agentOptions, selection);
  assert.equal(typeof resumeOptions[0].setup, 'function');

  // 删除绑定后再发消息 → 无绑定命中 → create，agentOptions 同样等于快照
  await store.delete('7');
  await incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', message: '/status' } });
  await runtime.whenSettled('7');
  assert.equal(createOptions.length, 1);
  assert.match(createOptions[0].sessionId, /^telegram-/);
  assert.deepEqual(createOptions[0].agentOptions, selection);
  assert.equal(typeof createOptions[0].setup, 'function');
  await runtime.stop();
  await rm(root, { recursive: true, force: true });
});

test('agent setup mounts the default preset so the agent scope has tools', async () => {
  // 回归锁定：不挂 preset → agent 作用域无工具 → 请求 tools=[] → DeepSeek 裸写 DSML。
  const root = await mkdtemp(join(tmpdir(), 'dsh-telegram-preset-'));
  const workspace = {
    path: root,
    async status() {
      return 'ok';
    },
    async attachSession() {},
  };
  const mountCalls = [];
  let incoming;
  const ctx = {
    credentials: {
      async resolve(ref) {
        return { value: `${ref}-value` };
      },
    },
    workspaceRegistry: {
      get() {
        return workspace;
      },
    },
    agentDefaultModel: {
      currentSelection() {
        return { provider: 'deepseek', model: 'deepseek-chat' };
      },
    },
    agentPresets: {
      async mount(agentCtx, id) {
        mountCalls.push({ agentCtx, id });
      },
    },
    agents: {
      async create(options) {
        await options.setup?.({
          on() {
            return () => {};
          },
        });
        const agent = {
          id: options.sessionId,
          session: { header: { cwd: root } },
          get status() {
            return 'idle';
          },
          followup() {},
          whenIdle() {
            return Promise.resolve();
          },
          cancel() {},
        };
        return { agent, async dispose() {} };
      },
      async resume() {
        throw new Error('not expected');
      },
    },
    get(key) {
      return key === 'agentPresets' ? this.agentPresets : undefined;
    },
    on() {},
    effect() {},
  };
  const runtime = new TelegramRuntime(
    ctx,
    {
      ownerUserId: '7',
      workspaceId: 'workspace-1',
      messageLimit: 100,
    },
    {
      openStore: memoryOpenStore(),
      async createClient(options) {
        incoming = options.onMessage;
        return {
          botId: '99',
          bot: {
            api: {
              async sendMessage() {
                return { message_id: 1 };
              },
              async editMessageText() {},
              async editMessageReplyMarkup() {},
              async answerCallbackQuery() {},
              async sendPhoto() {},
            },
          },
          botToken: 'token',
          fetchImpl: fetch,
          async close() {},
        };
      },
    },
  );
  await runtime.start();
  await incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', message: '/status' } });
  await runtime.whenSettled('7');
  // 必须挂载了默认 preset（id 为 undefined → defaultId）
  assert.equal(mountCalls.length, 1);
  assert.equal(mountCalls[0].id, undefined);
  await runtime.stop();
  await rm(root, { recursive: true, force: true });
});

test('reacts to an incoming owner message with 👀 for immediate feedback', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-telegram-react-'));
  const workspace = {
    path: root,
    async status() {
      return 'ok';
    },
    async attachSession() {},
  };
  const reactions = [];
  let incoming;
  const ctx = {
    credentials: {
      async resolve(ref) {
        return { value: `${ref}-value` };
      },
    },
    workspaceRegistry: {
      get() {
        return workspace;
      },
    },
    agentDefaultModel: {
      currentSelection() {
        return { provider: 'deepseek', model: 'deepseek-chat' };
      },
    },
    agents: {
      async create(options) {
        await options.setup?.({
          on() {
            return () => {};
          },
        });
        const agent = {
          id: options.sessionId,
          session: { header: { cwd: root } },
          get status() {
            return 'idle';
          },
          followup() {},
          whenIdle() {
            return Promise.resolve();
          },
          cancel() {},
        };
        return { agent, async dispose() {} };
      },
      async resume() {
        throw new Error('not expected');
      },
    },
    get() {
      return undefined;
    },
    on() {},
    effect() {},
  };
  const runtime = new TelegramRuntime(
    ctx,
    {
      ownerUserId: '7',
      workspaceId: 'workspace-1',
      messageLimit: 100,
    },
    {
      openStore: memoryOpenStore(),
      async createClient(options) {
        incoming = options.onMessage;
        return {
          botId: '99',
          bot: {
            api: {
              async sendMessage() {
                return { message_id: 1 };
              },
              async editMessageText() {},
              async editMessageReplyMarkup() {},
              async answerCallbackQuery() {},
              async sendPhoto() {},
              async setMessageReaction(payload) {
                reactions.push(payload);
                return true;
              },
            },
          },
          botToken: 'token',
          fetchImpl: fetch,
          async close() {},
        };
      },
    },
  );
  await runtime.start();
  await incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', messageId: '42', message: '/status' } });
  await runtime.whenSettled('7');
  // 处理中先设置 👀，完成后清除（reaction 为空数组）
  assert.equal(reactions.length, 2);
  assert.equal(reactions[0].chat_id, '7');
  assert.equal(reactions[0].message_id, 42);
  assert.deepEqual(reactions[0].reaction, [{ type: 'emoji', emoji: '👀' }]);
  assert.equal(reactions[1].message_id, 42);
  assert.deepEqual(reactions[1].reaction, []);
  // 非 owner 的消息不应触发 reaction
  reactions.length = 0;
  await incoming({ message: { isPrivate: true, senderId: '999', chatId: '999', messageId: '43', message: 'hi' } });
  assert.equal(reactions.length, 0);
  await runtime.stop();
  await rm(root, { recursive: true, force: true });
});

test('bridges approval/request to a Telegram card and resolves on the owner tap', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-telegram-approval-'));
  const workspace = {
    path: root,
    async status() {
      return 'ok';
    },
    async attachSession() {},
  };
  const sent = [];
  const editedCards = [];
  const answered = [];
  const setupHandlers = new Map();
  let incoming;
  let onCallback;
  let sentId = 0;
  const ctx = {
    credentials: {
      async resolve(ref) {
        return { value: `${ref}-value` };
      },
    },
    workspaceRegistry: {
      get() {
        return workspace;
      },
    },
    agentDefaultModel: {
      currentSelection() {
        return { provider: 'deepseek', model: 'deepseek-chat' };
      },
    },
    agents: {
      async create(options) {
        options.setup?.({
          on(event, handler) {
            setupHandlers.set(event, handler);
            return () => setupHandlers.delete(event);
          },
        });
        const agent = {
          id: options.sessionId,
          session: { header: { cwd: root } },
          get status() {
            return 'idle';
          },
          followup() {},
          whenIdle() {
            return Promise.resolve();
          },
          cancel() {},
        };
        return { agent, async dispose() {} };
      },
      async resume() {
        throw new Error('not expected');
      },
    },
    on() {},
    effect() {},
  };
  const runtime = new TelegramRuntime(
    ctx,
    { ownerUserId: '7', workspaceId: 'workspace-1', messageLimit: 100 },
    {
      openStore: memoryOpenStore(),
      async createClient(options) {
        incoming = options.onMessage;
        onCallback = options.onCallbackQuery;
        return {
          botId: '99',
          bot: {
            api: {
              async sendMessage(payload) {
                sent.push(payload);
                return { message_id: ++sentId };
              },
              async editMessageText() {},
              async editMessageReplyMarkup(payload) {
                editedCards.push(payload);
              },
              async answerCallbackQuery(payload) {
                answered.push(payload);
              },
              async sendPhoto() {},
            },
          },
          botToken: 'token',
          fetchImpl: fetch,
          async close() {},
        };
      },
    },
  );
  await runtime.start();
  // 建立会话（注册 approval/request 答复者）
  await incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', message: '/status' } });
  await runtime.whenSettled('7');
  const answerer = setupHandlers.get('approval/request');
  assert.equal(typeof answerer, 'function', '必须注册 approval/request 答复者');

  // 触发一次审批：answerer 返回挂起的 outcome，同时发出审批卡片
  const outcome = answerer({ toolName: 'bash', reason: '删除文件' });
  await new Promise((resolve) => setImmediate(resolve));
  const card = sent.find((payload) => payload.reply_markup && /审批请求/.test(payload.text ?? ''));
  assert.ok(card, '应发送带按钮的审批卡片');
  assert.equal(card.parse_mode, 'HTML');
  const approveBtn = card.reply_markup.inline_keyboard[0][0];
  assert.match(approveBtn.callback_data, /^dsh:approval:[^:]+:approve$/);

  // owner 点「批准」→ answerer resolve 成 allowed-once，按钮被撤下
  await onCallback({ callback: { id: 'cb-approve', senderId: '7', chatId: '7', data: approveBtn.callback_data } });
  assert.equal(await outcome, 'allowed-once');
  assert.match(answered.at(-1).text, /已批准/);
  assert.deepEqual(editedCards.at(-1).reply_markup, { inline_keyboard: [] });

  // 拒绝路径：另一次审批点「拒绝」→ rejected
  const outcome2 = answerer({ toolName: 'write', reason: '覆盖文件' });
  await new Promise((resolve) => setImmediate(resolve));
  const card2 = sent.filter((payload) => payload.reply_markup && /审批请求/.test(payload.text ?? '')).at(-1);
  const rejectBtn = card2.reply_markup.inline_keyboard[0][1];
  await onCallback({ callback: { id: 'cb-reject', senderId: '7', chatId: '7', data: rejectBtn.callback_data } });
  assert.equal(await outcome2, 'rejected');

  // 已中止的请求直接 cancelled，不发卡片
  const before = sent.length;
  assert.equal(await answerer({ toolName: 'bash', signal: { aborted: true } }), 'cancelled');
  assert.equal(sent.length, before);
  await runtime.stop();
  await rm(root, { recursive: true, force: true });
});

test('delivers in-workspace markdown images and rejects out-of-workspace paths', async () => {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const root = await mkdtemp(join(tmpdir(), 'dsh-telegram-img-'));
  const outside = await mkdtemp(join(tmpdir(), 'dsh-telegram-outside-'));
  await mkdir(join(root, 'out'), { recursive: true });
  const pngBytes = Buffer.from('89504e470d0a1a0a', 'hex'); // PNG 魔数即可
  await writeFile(join(root, 'out', 'chart.png'), pngBytes);
  await writeFile(join(outside, 'secret.png'), Buffer.from('secret'));
  const workspace = {
    path: root,
    async status() {
      return 'ok';
    },
    async attachSession() {},
  };
  const photos = [];
  const texts = [];
  let incoming;
  const assistantContent = [
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: `图在这 ![c](./out/chart.png) 还有越界的 ![s](${join(outside, 'secret.png')}) 和缺失的 ![m](./out/missing.png)`,
        },
      ],
    },
  ];
  const ctx = {
    credentials: {
      async resolve(ref) {
        return { value: `${ref}-value` };
      },
    },
    workspaceRegistry: {
      get() {
        return workspace;
      },
    },
    agentDefaultModel: {
      currentSelection() {
        return { provider: 'deepseek', model: 'deepseek-chat' };
      },
    },
    agents: {
      async create(options) {
        options.setup?.({
          on() {
            return () => {};
          },
        });
        const agent = {
          id: options.sessionId,
          session: {
            header: { cwd: root },
            deriveMessages() {
              return assistantContent;
            },
          },
          get status() {
            return 'idle';
          },
          followup() {},
          whenIdle() {
            return Promise.resolve();
          },
          cancel() {},
        };
        return { agent, async dispose() {} };
      },
      async resume() {
        throw new Error('not expected');
      },
    },
    on() {},
    effect() {},
  };
  const runtime = new TelegramRuntime(
    ctx,
    { ownerUserId: '7', workspaceId: 'workspace-1', messageLimit: 100 },
    {
      openStore: memoryOpenStore(),
      async createClient(options) {
        incoming = options.onMessage;
        return {
          botId: '99',
          bot: {
            api: {
              async sendMessage(payload) {
                texts.push(payload);
                return { message_id: 1 };
              },
              async editMessageText() {},
              async editMessageReplyMarkup() {},
              async answerCallbackQuery() {},
              async sendPhoto(payload) {
                photos.push(payload);
              },
            },
          },
          botToken: 'token',
          fetchImpl: fetch,
          async close() {},
        };
      },
    },
  );
  await runtime.start();
  await incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', message: 'draw me a chart' } });
  await runtime.whenSettled('7');
  // 仅工作区内存在的图片被发送；越界与缺失的都不发
  assert.equal(photos.length, 1);
  assert.equal(photos[0].chat_id, '7');
  await runtime.stop();
  await rm(root, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

test('dedupes the same in-workspace image referenced multiple ways', async () => {
  const { writeFile } = await import('node:fs/promises');
  const root = await mkdtemp(join(tmpdir(), 'dsh-telegram-dedup-'));
  const pngBytes = Buffer.from('89504e470d0a1a0a', 'hex');
  await writeFile(join(root, 'blue.png'), pngBytes);
  const workspace = {
    path: root,
    async status() {
      return 'ok';
    },
    async attachSession() {},
  };
  const photos = [];
  let incoming;
  // 同一文件用相对名与绝对路径各引用一次：realpath 归一后应只发一张。
  const assistantContent = [
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: `生成了 \`blue.png\`，路径：\`${join(root, 'blue.png')}\``,
        },
      ],
    },
  ];
  const ctx = {
    credentials: {
      async resolve(ref) {
        return { value: `${ref}-value` };
      },
    },
    workspaceRegistry: {
      get() {
        return workspace;
      },
    },
    agentDefaultModel: {
      currentSelection() {
        return { provider: 'deepseek', model: 'deepseek-chat' };
      },
    },
    agents: {
      async create(options) {
        options.setup?.({
          on() {
            return () => {};
          },
        });
        const agent = {
          id: options.sessionId,
          session: {
            header: { cwd: root },
            deriveMessages() {
              return assistantContent;
            },
          },
          get status() {
            return 'idle';
          },
          followup() {},
          whenIdle() {
            return Promise.resolve();
          },
          cancel() {},
        };
        return { agent, async dispose() {} };
      },
      async resume() {
        throw new Error('not expected');
      },
    },
    on() {},
    effect() {},
  };
  const runtime = new TelegramRuntime(
    ctx,
    { ownerUserId: '7', workspaceId: 'workspace-1', messageLimit: 100 },
    {
      openStore: memoryOpenStore(),
      async createClient(options) {
        incoming = options.onMessage;
        return {
          botId: '99',
          bot: {
            api: {
              async sendMessage() {
                return { message_id: 1 };
              },
              async editMessageText() {},
              async editMessageReplyMarkup() {},
              async answerCallbackQuery() {},
              async sendPhoto(payload) {
                photos.push(payload);
              },
            },
          },
          botToken: 'token',
          fetchImpl: fetch,
          async close() {},
        };
      },
    },
  );
  await runtime.start();
  await incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', message: 'draw blue' } });
  await runtime.whenSettled('7');
  assert.equal(photos.length, 1);
  await runtime.stop();
  await rm(root, { recursive: true, force: true });
});
