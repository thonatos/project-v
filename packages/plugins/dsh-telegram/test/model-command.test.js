import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TelegramRuntime } from '../src/runtime.js';
import { TELEGRAM_COMMAND_NAMES } from '../src/transport/client.js';

// 共享测试台：模型选择相关的用例都需要同一套 ctx（llm 目录、agentDefaultModel 回落、
// agents.create/resume 记录、绑定存储），逐个用例内联会重复上百行。
// 返回 runtime 及其观测点；调用方通过 send() 投递 Owner 私聊消息。
async function harness({
  providers = [{ id: 'deepseek', name: 'DeepSeek' }],
  models = { deepseek: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }] },
  listModels,
  resolveModelInfo,
  defaultSelection = { provider: 'deepseek', model: 'deepseek-chat' },
  bindings = [],
  resume,
  resumeCwd,
  workspaces,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-telegram-model-'));
  const workspaceList = workspaces ?? [{ id: 'workspace-1', title: 'Main', path: root }];
  const registry = new Map(
    workspaceList.map((entry) => [
      String(entry.id),
      {
        ...entry,
        path: entry.path ?? root,
        async status() {
          return entry.status ?? 'ok';
        },
        async attachSession() {},
      },
    ]),
  );

  const rows = new Map(bindings.map(([key, value]) => [String(key), { ...value }]));
  // 复刻 persist.js 的 merge 语义：整对象覆盖会掩盖「字段被抹掉」这类缺陷。
  const store = {
    rows,
    get: (key) => rows.get(String(key)) ?? null,
    async set(key, patch) {
      const current = rows.get(String(key));
      const next = { ...current, ...patch };
      if (!next.sessionId || !next.workspaceId) throw new TypeError('A session binding is required');
      rows.set(String(key), next);
    },
    async delete(key) {
      rows.delete(String(key));
    },
    async close() {},
  };

  const createOptions = [];
  const resumeOptions = [];

  const sent = [];
  const agents = new Map();
  let nextId = 0;

  const makeAgent = (id, cwd) => {
    const agent = {
      id,
      session: { header: { cwd } },
      status: 'idle',
      followups: [],
      followup(message) {
        agent.followups.push(message);
      },
      whenIdle() {
        return Promise.resolve();
      },
      cancels: [],
      cancel(...args) {
        agent.cancels.push(args);
      },
    };
    agents.set(id, agent);
    return agent;
  };

  // agentCtx 的最小替身：runtime 会在其上注册桥接与模型选择。
  const makeAgentCtx = () => ({
    on() {
      return () => {};
    },
  });

  const ctx = {
    credentials: {
      async resolve(ref) {
        return { value: `${ref}-value` };
      },
    },
    workspaceRegistry: {
      get: (id) => registry.get(String(id)),
      list: () => [...registry.values()],
    },
    agentDefaultModel: {
      currentSelection() {
        return defaultSelection ? { ...defaultSelection } : undefined;
      },
      saveSelection() {
        throw new Error('私聊级选择不得写入全局默认');
      },
    },
    llm: {
      listProviders: () => providers.map((entry) => ({ ...entry })),
      listModels: listModels ?? (async (provider) => (models[provider] ?? []).map((entry) => ({ ...entry, provider }))),
      resolveModelInfo:
        resolveModelInfo ??
        (async (provider, model) => {
          const known = (models[provider] ?? []).some((entry) => entry.id === model);
          if (!known) throw new Error(`model ${provider}/${model} is not routable`);
          return { provider, id: model, name: model };
        }),
    },
    agentPresets: {
      async mount() {},
    },
    agents: {
      get: (id) => agents.get(String(id)),
      async create(options) {
        createOptions.push(options);
        const agentCtx = makeAgentCtx();
        const agent = makeAgent(options.sessionId ?? `telegram-${++nextId}`, options.meta?.cwd ?? root);
        agent.ctx = agentCtx;
        await options.setup?.(agentCtx, agent);
        return { agent, async dispose() {} };
      },
      async resume(options) {
        resumeOptions.push(options);
        if (resume === 'reject') throw new Error('resume failed');
        const agentCtx = makeAgentCtx();
        // resumeCwd 用于模拟「恢复出的会话不属于当前 Workspace」这条分支。
        const agent = makeAgent(options.resumeSessionId, resumeCwd ?? root);
        agent.ctx = agentCtx;
        await options.setup?.(agentCtx, agent);
        return { agent, async dispose() {} };
      },
    },
    on() {
      return () => {};
    },
    effect() {},
  };

  let incoming;
  let callback;
  const client = {
    botId: '99',
    bot: {
      api: {
        async sendMessage(payload) {
          sent.push(payload);
          return { message_id: sent.length };
        },
        async editMessageText() {},
        async editMessageReplyMarkup() {},
        async answerCallbackQuery() {},
        async setMessageReaction() {},
        async deleteMessage() {},
        async sendPhoto() {},
      },
    },
    botToken: 'token',
    fetchImpl: fetch,
    async close() {},
  };
  const config = { ownerUserId: '7', workspaceId: String(workspaceList[0].id), messageLimit: 4096 };
  const deps = {
    openStore: async () => store,
    async createClient(options) {
      incoming = options.onMessage;
      callback = options.onCallbackQuery;
      return client;
    },
  };
  const runtime = new TelegramRuntime(ctx, config, deps);
  await runtime.start();

  const surface = (activeRuntime) => ({
    runtime: activeRuntime,
    root,
    store,
    sent,
    createOptions,
    resumeOptions,
    agents,
    ctx,
    // 投递一条 Owner 私聊消息并等待该聊天的串行队列排空。
    async send(text) {
      await incoming({ message: { isPrivate: true, senderId: '7', chatId: '7', message: text } });
      await activeRuntime.whenSettled('7');
    },
    async click(data) {
      await callback({ callback: { id: 'cb-1', senderId: '7', chatId: '7', messageId: '1', data } });
    },
    lastText: () => sent.at(-1)?.text ?? '',
    allText: () => sent.map((entry) => entry.text).join('\n'),
    // 在同一 ctx 上重建 runtime：新实例句柄表为空，而注册表里的 agent 仍存活，
    // 从而自然走到 #ensureBridges 的「复用已存活 agent」补装路径。
    async restart() {
      await activeRuntime.stop();
      createOptions.length = 0;
      resumeOptions.length = 0;
      sent.length = 0;
      const next = new TelegramRuntime(ctx, config, deps);
      await next.start();
      return surface(next);
    },
    async cleanup() {
      await activeRuntime.stop();
      await rm(root, { recursive: true, force: true });
    },
  });

  return surface(runtime);
}

test('preserves the model selection across a workspace switch', async () => {
  // 回归锁定（tasks 1.2）：#switchWorkspace 的绑定写入只带 sessionId/workspaceId。
  // 若为整对象覆盖，切一次 Workspace 就会静默抹掉模型选择并回落全局默认。
  const second = await mkdtemp(join(tmpdir(), 'dsh-telegram-ws2-'));
  const h = await harness({
    models: {
      deepseek: [
        { id: 'deepseek-chat', name: 'Chat' },
        { id: 'deepseek-reasoner', name: 'Reasoner' },
      ],
    },
    workspaces: [
      { id: 'workspace-1', title: 'Main' },
      { id: 'workspace-2', title: 'Second', path: second },
    ],
  });
  await h.send('/model deepseek deepseek-reasoner');
  assert.equal(h.store.get('7').model, 'deepseek-reasoner');

  await h.click('dsh:workspace:select:workspace-2');
  const binding = h.store.get('7');
  assert.equal(binding.workspaceId, 'workspace-2', '应已切换 Workspace');
  assert.equal(binding.provider, 'deepseek', '切换 Workspace 不得抹掉 provider');
  assert.equal(binding.model, 'deepseek-reasoner', '切换 Workspace 不得抹掉 model');
  // 新 Session 必须用绑定里的选择，而非全局默认。
  assert.deepEqual(h.createOptions.at(-1).agentOptions, {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
  });
  await h.cleanup();
  await rm(second, { recursive: true, force: true });
});

test('preserves the model selection when a failed resume rebuilds the session', async () => {
  // 回归锁定（tasks 1.3）：resume 抛错 → 删绑定 → 重建。重建的写入若整对象覆盖，
  // 模型选择同样被静默抹掉。注意 delete 会移除整条绑定，因此重建路径必须显式携带选择。
  const h = await harness({
    models: {
      deepseek: [
        { id: 'deepseek-chat', name: 'Chat' },
        { id: 'deepseek-reasoner', name: 'Reasoner' },
      ],
    },
    bindings: [
      [
        '7',
        { sessionId: 'telegram-stale', workspaceId: 'workspace-1', provider: 'deepseek', model: 'deepseek-reasoner' },
      ],
    ],
    resume: 'reject',
  });
  await h.send('hello');
  assert.equal(h.resumeOptions.length, 1, 'resume 应被尝试过一次');
  const binding = h.store.get('7');
  assert.notEqual(binding.sessionId, 'telegram-stale', '会话应已重建');
  assert.equal(binding.provider, 'deepseek', 'resume 失败重建不得抹掉 provider');
  assert.equal(binding.model, 'deepseek-reasoner', 'resume 失败重建不得抹掉 model');
  assert.deepEqual(h.createOptions.at(-1).agentOptions, {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
  });
  await h.cleanup();
});

export { harness };

const TWO_MODELS = {
  deepseek: [
    { id: 'deepseek-chat', name: 'Chat' },
    { id: 'deepseek-reasoner', name: 'Reasoner' },
  ],
};

test('prefers the chat-level selection over the global default on create and resume', async () => {
  // tasks 3.4：绑定含选择时，create 与 resume 两侧的 agentOptions 都必须等于绑定值。
  const h = await harness({
    models: TWO_MODELS,
    defaultSelection: { provider: 'deepseek', model: 'deepseek-chat' },
    bindings: [
      [
        '7',
        { sessionId: 'telegram-bound', workspaceId: 'workspace-1', provider: 'deepseek', model: 'deepseek-reasoner' },
      ],
    ],
  });
  await h.send('hello');
  assert.deepEqual(h.resumeOptions.at(-1).agentOptions, {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
  });

  // 删除绑定后重新走 create：无私聊级选择 → 回落全局默认。
  await h.store.delete('7');
  await h.send('hello again');
  assert.deepEqual(h.createOptions.at(-1).agentOptions, {
    provider: 'deepseek',
    model: 'deepseek-chat',
  });
  await h.cleanup();
});

test('carries the switched model into the session created by /new', async () => {
  // tasks 3.5：这是用户明确要求的行为——/new 之后仍用切换后的模型。
  const h = await harness({ models: TWO_MODELS });
  await h.send('/model deepseek deepseek-reasoner');
  const before = h.createOptions.length;
  await h.send('/new');
  assert.ok(h.createOptions.length > before, '/new 应创建新 Session');
  assert.deepEqual(h.createOptions.at(-1).agentOptions, {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
  });
  assert.equal(h.store.get('7').model, 'deepseek-reasoner');
  await h.cleanup();
});

test('never writes the chat-level selection into the global default', async () => {
  // tasks 3.6：私聊级选择不得污染全局设置（harness 的 saveSelection 会抛错）。
  const h = await harness({ models: TWO_MODELS });
  const calls = [];
  h.ctx.agentDefaultModel.saveSelection = async (next) => {
    calls.push(next);
  };
  await h.send('/model deepseek deepseek-reasoner');
  assert.deepEqual(calls, [], '不得调用 saveSelection');
  await h.cleanup();
});

test('lists providers and models as click-to-copy commands', async () => {
  // tasks 5.6：每行是一个完整的 /model 命令，包在 <code> 里 —— Telegram 的 code 实体
  // 点一下整段复制，复制出来即可直接发送，无需手工拼接。
  const h = await harness({
    providers: [
      { id: 'deepseek', name: 'DeepSeek' },
      { id: 'openrouter', name: 'OpenRouter' },
    ],
    models: {
      deepseek: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }],
      openrouter: [{ id: 'anthropic/claude-sonnet-4.5' }],
    },
  });
  await h.send('/model');
  const text = h.allText();
  assert.match(text, /当前 · <code>deepseek deepseek-chat<\/code>/);
  // provider 分组标题加粗，当前项打勾。
  assert.match(text, /<b>DeepSeek · deepseek<\/b>/);
  assert.match(text, /^✓ <code>\/model deepseek deepseek-chat<\/code>$/m);
  assert.match(text, /^ {2}<code>\/model deepseek deepseek-reasoner<\/code>$/m);
  // 长 model id 完整保留：手动输入没有 callback_data 的 64 字节限制。
  assert.match(text, /<code>\/model openrouter anthropic\/claude-sonnet-4\.5<\/code>/);
  // 清单用 HTML 实体渲染 code 块，必须声明 parse_mode。
  assert.equal(h.sent.at(-1).parse_mode, 'HTML');
  await h.cleanup();
});

test('escapes provider and model names in the listing', async () => {
  // 清单走 HTML，任何来自 provider 的动态值都必须转义，否则畸形 id 会破坏标签结构。
  const h = await harness({
    providers: [{ id: 'evil', name: '<script>x</script>' }],
    models: { evil: [{ id: 'a<b>&c' }] },
    defaultSelection: undefined,
    resolveModelInfo: async () => ({ provider: 'evil', id: 'a<b>&c' }),
  });
  await h.send('/model');
  const text = h.allText();
  assert.match(text, /&lt;script&gt;/);
  assert.doesNotMatch(text, /<script>/);
  assert.match(text, /a&lt;b&gt;&amp;c/);
  await h.cleanup();
});

test('isolates one provider catalog failure from the rest of the list', async () => {
  // tasks 5.7：单 provider 失败不得中断整个清单。
  const h = await harness({
    providers: [
      { id: 'broken', name: 'Broken' },
      { id: 'deepseek', name: 'DeepSeek' },
    ],
    models: { deepseek: [{ id: 'deepseek-chat' }] },
    async listModels(provider) {
      if (provider === 'broken') throw new Error('Bad Request: catalog unavailable');
      return [{ id: 'deepseek-chat' }];
    },
  });
  await h.send('/model');
  const text = h.allText();
  assert.match(text, /目录不可用/);
  assert.match(text, /deepseek deepseek-chat/, '其余 provider 仍须列出');
  // 失败原因须脱敏，不回显原始 Telegram/HTTP 细节。
  assert.doesNotMatch(text, /Bad Request/);
  await h.cleanup();
});

test('splits a long model list across messages without breaking tags', async () => {
  // tasks 5.8：清单长度不可预测，必须分片。分片以行为单位，因此每个 <code>
  // 完整落在同一片内 —— 按字符切会劈断标签并被 Telegram 拒绝。
  const many = Array.from({ length: 400 }, (_, index) => ({ id: `model-${index}-${'x'.repeat(20)}` }));
  const h = await harness({
    providers: [{ id: 'bulk', name: 'Bulk' }],
    models: { bulk: many },
    defaultSelection: { provider: 'bulk', model: 'model-0' },
    resolveModelInfo: async () => ({ provider: 'bulk', id: 'model-0' }),
  });
  await h.send('/model');
  assert.ok(h.sent.length > 1, '超长清单应被分片为多条消息');
  for (const payload of h.sent) {
    assert.ok(payload.text.length <= 4096, '每片不得超过 Telegram 单条上限');
    // 标签配对检查：任何一片里 <code> 与 </code> 数量必须相等。
    const open = payload.text.match(/<code>/g)?.length ?? 0;
    const close = payload.text.match(/<\/code>/g)?.length ?? 0;
    assert.equal(open, close, '分片不得劈断 <code> 标签');
    assert.equal(payload.parse_mode, 'HTML');
  }
  assert.match(h.allText(), /model-399/, '不得截断尾部内容');
  await h.cleanup();
});

test('reports a missing provider set instead of sending an empty message', async () => {
  // tasks 5.5
  const h = await harness({ providers: [], models: {}, defaultSelection: undefined });
  await h.send('/model');
  assert.match(h.lastText(), /没有可用 provider/);
  await h.cleanup();
});

test('switches the live session without creating a new one', async () => {
  // tasks 6.6：热切换的核心断言——生效模型已改、未新建 Session。
  // 回复文案区分「当前会话下一轮生效」与「将在新会话生效」，是热切换是否真的装上的
  // 唯一用户可见信号：绑定无论如何都会写，光看绑定或 /status 无法区分两者。
  const h = await harness({ models: TWO_MODELS });
  await h.send('hello');
  const created = h.createOptions.length;
  const agentId = h.store.get('7').sessionId;

  await h.send('/model deepseek deepseek-reasoner');
  assert.equal(h.createOptions.length, created, '切换不得创建新 Session');
  assert.equal(h.store.get('7').sessionId, agentId, 'Session 身份不得变化');
  assert.match(h.lastText(), /当前会话下一轮生效/, '存活会话须走热切换而非等新会话');

  await h.send('/status');
  assert.match(h.lastText(), /deepseek deepseek-reasoner/, '生效模型应已更新');
  await h.cleanup();
});

test('leaves the binding and effective model untouched when the route is rejected', async () => {
  // tasks 6.7
  const h = await harness({ models: TWO_MODELS });
  await h.send('hello');
  const before = { ...h.store.get('7') };

  await h.send('/model deepseek deepsek-typo');
  assert.deepEqual(h.store.get('7'), before, '校验失败不得改动绑定');
  assert.match(h.lastText(), /不可用/);

  await h.send('/status');
  assert.match(h.lastText(), /deepseek deepseek-chat/, '生效模型应保持原值');
  await h.cleanup();
});

test('accepts a routable model that is absent from the catalog', async () => {
  // tasks 6.8：dsh 明确规定目录是 advisory，不得当白名单用。
  const h = await harness({
    models: { deepseek: [{ id: 'deepseek-chat' }] },
    // 目录只报一个模型，但 resolveModelInfo 认可另一个尚未登记的新模型。
    resolveModelInfo: async (provider, model) => {
      if (provider !== 'deepseek') throw new Error('unknown provider');
      return { provider, id: model };
    },
  });
  await h.send('/model deepseek deepseek-v9-preview');
  assert.equal(h.store.get('7').model, 'deepseek-v9-preview');
  assert.match(h.lastText(), /已切换模型/);
  await h.cleanup();
});

test('installs the selection on the reused live agent path', async () => {
  // tasks 6.9：ctx.agents.get 复用路径不跑 setup。若模型选择漏装，/model 对该会话静默无效。
  // 用「同一 ctx 上重建 runtime」自然触发该路径：新 runtime 的句柄表为空，
  // 而注册表里的 agent 仍存活——正是 Runtime 重启后的真实形态。
  const h = await harness({ models: TWO_MODELS });
  await h.send('hello');
  const agentId = h.store.get('7').sessionId;

  const revived = await h.restart();
  await revived.send('/model deepseek deepseek-reasoner');
  assert.equal(revived.createOptions.length, 0, '复用路径不得新建 Session');
  assert.equal(revived.store.get('7').sessionId, agentId, '应复用原 Session');
  // 关键断言：复用路径上模型选择必须已补装，否则只会说「将在新会话生效」——
  // 那正是漏装时的静默失败形态（绑定照样写，用户以为已生效）。
  assert.match(revived.lastText(), /当前会话下一轮生效/, '复用路径须补装模型选择');

  await revived.send('/status');
  assert.match(revived.lastText(), /deepseek deepseek-reasoner/, '复用路径上切换须生效');
  await h.cleanup();
});

test('accepts a switch while a turn is running without cancelling it', async () => {
  // tasks 6.10：官方语义是「下一 step 生效」，因此不该中断当前 turn。
  const h = await harness({ models: TWO_MODELS });
  await h.send('hello');
  const agent = h.agents.get(h.store.get('7').sessionId);
  agent.status = 'running';

  await h.send('/model deepseek deepseek-reasoner');
  assert.deepEqual(agent.cancels, [], '不得取消正在进行的 turn');
  assert.equal(h.store.get('7').model, 'deepseek-reasoner');
  await h.cleanup();
});

test('falls back and warns once when the stored selection is no longer routable', async () => {
  // tasks 7.2：禁止静默降级——这是唯一会主动打扰用户的路径，但静默漂移更糟。
  const h = await harness({
    models: { deepseek: [{ id: 'deepseek-chat' }] },
    defaultSelection: { provider: 'deepseek', model: 'deepseek-chat' },
    bindings: [
      ['7', { sessionId: 'telegram-stale', workspaceId: 'workspace-1', provider: 'retired', model: 'gone-v1' }],
    ],
  });
  await h.send('hello');
  assert.match(h.allText(), /已保存的模型当前不可用/);
  // 回落后仍能正常建立会话，且用的是全局默认。
  const options = h.resumeOptions.at(-1) ?? h.createOptions.at(-1);
  assert.deepEqual(options.agentOptions, { provider: 'deepseek', model: 'deepseek-chat' });
  await h.cleanup();
});

test('preserves the model selection when a resumed session has the wrong cwd', async () => {
  // resume 成功但 cwd 不属于当前 Workspace 时，runtime 会 dispose 该会话、delete 绑定，
  // 再落到重建路径。这条分支同样先 delete，因此必须显式带回模型选择。
  const elsewhere = await mkdtemp(join(tmpdir(), 'dsh-telegram-elsewhere-'));
  const h = await harness({
    models: TWO_MODELS,
    bindings: [
      [
        '7',
        {
          sessionId: 'telegram-wrong-cwd',
          workspaceId: 'workspace-1',
          provider: 'deepseek',
          model: 'deepseek-reasoner',
        },
      ],
    ],
    resumeCwd: elsewhere,
  });
  await h.send('hello');
  const binding = h.store.get('7');
  assert.notEqual(binding.sessionId, 'telegram-wrong-cwd', 'cwd 不匹配的会话应被弃用');
  assert.equal(binding.model, 'deepseek-reasoner', 'cwd 不匹配重建不得抹掉模型选择');
  assert.deepEqual(h.createOptions.at(-1).agentOptions, {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
  });
  await h.cleanup();
  await rm(elsewhere, { recursive: true, force: true });
});

test('rejects a /model invocation whose argument count is not two', async () => {
  const h = await harness({ models: TWO_MODELS });
  for (const input of ['/model deepseek', '/model deepseek deepseek-chat extra']) {
    await h.send(input);
    assert.match(h.lastText(), /用法不正确/, `应拒绝：${input}`);
  }
  assert.equal(h.store.get('7'), null, '用法错误不得建立或改动绑定');
  await h.cleanup();
});

test('parses /model argument forms through the command surface', async () => {
  // tasks 4.7：parseCommand 未导出，因此从真实命令面观测其行为。
  const h = await harness({ models: TWO_MODELS });

  // 零参数 → 清单（HTML，含点击即复制的 code 行）。
  await h.send('/model');
  assert.equal(h.sent.at(-1).parse_mode, 'HTML');
  assert.match(h.lastText(), /当前 · /);

  // @botname 后缀须被接受（群组里 Telegram 会自动加上）。
  await h.send('/model@my_bot deepseek deepseek-reasoner');
  assert.match(h.lastText(), /已切换模型/);
  assert.equal(h.store.get('7').model, 'deepseek-reasoner');

  // 多余空白不得影响切分。
  await h.send('/model   deepseek    deepseek-chat  ');
  assert.match(h.lastText(), /已切换模型/);
  assert.equal(h.store.get('7').model, 'deepseek-chat');

  // 未知命令仍走 unsupported，且提示已含 /model。
  await h.send('/nope');
  assert.match(h.lastText(), /该命令不可用/);
  assert.match(h.lastText(), /\/model/);

  // /workspace 带参数仍维持既有的 unsupported 行为（不得被 /model 的改动带偏）。
  await h.send('/workspace workspace-1');
  assert.match(h.lastText(), /该命令不可用/);
  await h.cleanup();
});

test('renders /help from the single command source in sorted order', async () => {
  const h = await harness({ models: TWO_MODELS });
  await h.send('/help');
  const text = h.lastText();
  // 帮助内容由 TELEGRAM_COMMAND_NAMES 派生，顺序必须与之完全一致——
  // 命令清单曾在菜单、/help、错误提示三处各维护一份，加命令时容易漏改其一。
  // 只取 <code> 块内的正文，避免把 HTML 标签自身当成命令名匹配到。
  const body = /<code>([\s\S]*?)<\/code>/.exec(text)?.[1] ?? '';
  const listed = body.split('\n').filter(Boolean);
  assert.deepEqual(listed, TELEGRAM_COMMAND_NAMES);
  assert.equal(listed.at(-1), '/workspace', '最长的 /workspace 应排在末尾');
  await h.cleanup();
});

test('lists every command in the unsupported-command hint', async () => {
  const h = await harness({ models: TWO_MODELS });
  await h.send('/definitely-not-a-command');
  const text = h.lastText();
  assert.match(text, /该命令不可用/);
  for (const name of TELEGRAM_COMMAND_NAMES) {
    assert.ok(text.includes(name), `提示应包含 ${name}`);
  }
  await h.cleanup();
});
