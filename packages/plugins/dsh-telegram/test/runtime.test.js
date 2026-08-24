import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TelegramRuntime, userFacingError, defaultStatePath } from '../src/runtime.js';

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

test('defaultStatePath resolves under DSH_HOME, never under process.cwd()', () => {
  const original = process.env.DSH_HOME;
  try {
    process.env.DSH_HOME = '/tmp/dsh-home-fixture';
    const resolved = defaultStatePath();
    assert.equal(resolved, '/tmp/dsh-home-fixture/telegram-sessions.json');
    // 绝不落在项目工作区（cwd）里
    assert.ok(!resolved.startsWith(process.cwd()), 'state path must not live under cwd');
    // 未设 DSH_HOME 时回退到用户家目录下的 .dsh，仍不在 cwd
    delete process.env.DSH_HOME;
    const fallback = defaultStatePath();
    assert.match(fallback, /[/\\]\.dsh[/\\]telegram-sessions\.json$/);
    assert.ok(!fallback.startsWith(process.cwd()), 'fallback path must not live under cwd');
  } finally {
    if (original === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = original;
  }
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
      statePath: join(root, 'bindings.json'),
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
  const assembled = await setupHandlers.get('system-prompt/assemble')({}, {}, async () => ({
    variables: { existing: 'yes' },
  }));
  assert.deepEqual(assembled.variables, {
    existing: 'yes',
    provider: 'deepseek',
    model: 'deepseek-chat',
  });
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
      statePath: join(root, 'bindings.json'),
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

test('model selection: agent/request uses the assemble-time snapshot, not a fresh currentSelection', async () => {
  // 回归锁定：曾经的 bug 是 assemble 与 request 各自调用 currentSelection()，
  // 二者可能拿到不同 provider/model，导致 system-prompt 与实际请求漂移，
  // DeepSeek 适配器随之走非结构化路径、把工具调用裸写成 <｜｜DSML｜｜...> 文本。
  const root = await mkdtemp(join(tmpdir(), 'dsh-telegram-sel-'));
  const workspace = {
    path: root,
    async status() {
      return 'ok';
    },
    async attachSession() {},
  };
  const setupHandlers = new Map();
  const createOptions = [];
  let calls = 0;
  const selections = [
    { provider: 'deepseek', model: 'deepseek-chat' },
    { provider: 'other', model: 'drifted-model' },
    { provider: 'third', model: 'drifted-again' },
  ];
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
        return selections[Math.min(calls++, selections.length - 1)];
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
    {
      ownerUserId: '7',
      workspaceId: 'workspace-1',
      messageLimit: 100,
    },
    {
      statePath: join(root, 'bindings.json'),
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

  assert.deepEqual(createOptions[0].agentOptions, { provider: 'deepseek', model: 'deepseek-chat' });
  const assembleHandler = setupHandlers.get('system-prompt/assemble');
  const requestHandler = setupHandlers.get('agent/request');
  assert.equal(typeof assembleHandler, 'function');
  assert.equal(typeof requestHandler, 'function');
  const assembled = await assembleHandler({}, {}, async () => ({ variables: {} }));
  // request 必须复用 assemble 阶段落定的同一 provider/model，而非再取一次 currentSelection
  const requested = await requestHandler({}, async () => ({
    provider: 'STALE',
    model: 'STALE',
    reasoningEffort: 'high',
  }));
  assert.equal(requested.provider, assembled.variables.provider);
  assert.equal(requested.model, assembled.variables.model);
  assert.equal(requested.provider, 'deepseek');
  // 未显式带 effort 时，继承的 reasoningEffort 被剥离
  assert.equal(requested.reasoningEffort, undefined);
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
      statePath: join(root, 'bindings.json'),
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
      statePath: join(root, 'bindings.json'),
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
