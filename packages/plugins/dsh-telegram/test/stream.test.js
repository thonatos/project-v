import test from 'node:test';
import assert from 'node:assert/strict';
import { StreamSession } from '../src/render/stream.js';

function makeTransport() {
  const calls = [];
  let id = 0;
  return {
    calls,
    async sendText(chatId, text, opts) {
      calls.push(['sendText', chatId, text, opts]);
      return { message_id: ++id };
    },
    async editText(chatId, messageId, text, opts) {
      calls.push(['editText', chatId, messageId, text, opts]);
    },
    async sendCard(chatId, text) {
      calls.push(['sendCard', chatId, text]);
      return { message_id: ++id };
    },
    async editCard(chatId, messageId, markup) {
      calls.push(['editCard', chatId, messageId, markup]);
    },
  };
}

test('serializes concurrently-dispatched events without duplicating body', async () => {
  // 复现真机 bug 的真正成因：runtime 的 #onSessionEvent 用 `void handleEvent(event)`
  // fire-and-forget 投递，事件间不 await。当 sendCard/sendText 有真实延迟时，
  // tool/call、text-delta、tool/result 的 async 处理体会并发交错：
  // resetRenderer 与 flush、卡片定稿相互穿插 → 正文重复、卡片卡在“执行中”。
  const calls = [];
  let id = 0;
  const delay = () => new Promise((r) => setTimeout(r, 5));
  const transport = {
    async sendText(chatId, text, opts) {
      await delay();
      calls.push(['sendText', text, opts]);
      return { message_id: ++id };
    },
    async editText(chatId, messageId, text) {
      await delay();
      calls.push(['editText', messageId, text]);
    },
    async sendCard(chatId, text) {
      await delay();
      calls.push(['sendCard', text]);
      return { message_id: ++id };
    },
    async editCard() {},
  };
  let clock = 0;
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => (clock += 2000) });
  // 模拟 runtime：不 await，逐个 fire-and-forget 投递（保留到达顺序）。
  const dispatch = (event) => void stream.handleEvent(event);
  dispatch({ type: 'tool/call', data: { callId: 'c1', name: 'bash' } });
  dispatch({ type: 'assistant/chunk', data: { chunk: { type: 'text-delta', index: 0, text: '已' } } });
  dispatch({ type: 'assistant/chunk', data: { chunk: { type: 'text-delta', index: 0, text: '删除 X。' } } });
  dispatch({ type: 'tool/result', data: { callId: 'c1' } });
  await stream.finalize();
  // 工具后正文只应有一条 sendText，且卡片必须被定稿为“完成”。
  const bodySends = calls.filter((c) => c[0] === 'sendText');
  const cardDone = calls.filter((c) => c[0] === 'editText' && /完成|失败/.test(c[2]));
  assert.equal(bodySends.length, 1, '正文不应重复发送');
  assert.equal(cardDone.length, 1, '工具卡片必须被定稿');
  assert.equal(stream.text, '已删除 X。');
});

test('does not duplicate post-tool body when the first delta flushes early', async () => {
  // 复现真机 bug：工具卡片之后，模型先吐一小段正文“已”（触发一次 flush → send 一条），
  // 随后补全为“已删除 X。”。补全必须 edit 那条“已”，而不是再 send 一条完整正文，
  // 否则用户会看到：卡片 → “已” → “已删除 X。”（正文重复）。
  const transport = makeTransport();
  let clock = 0;
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => clock });
  await stream.handleEvent({ type: 'tool/call', data: { callId: 'c1', name: 'bash' } });
  await stream.handleEvent({ type: 'tool/result', data: { callId: 'c1' } });
  // 工具后第一段正文 → 立即 flush（now 未推进，elapsed 极大）→ send 一条
  await stream.handleEvent({ type: 'assistant/chunk', data: { chunk: { type: 'text-delta', index: 0, text: '已' } } });
  // 补全 → finalize 强制刷新，应 edit 同一条
  clock += 2000;
  await stream.handleEvent({
    type: 'assistant/chunk',
    data: { chunk: { type: 'text-delta', index: 0, text: '删除 X。' } },
  });
  await stream.finalize();
  // 工具后正文只应产生一条 sendText（那条“已”），其余为对它的 editText。
  const bodySends = transport.calls.filter((c) => c[0] === 'sendText');
  const bodyEdits = transport.calls.filter((c) => c[0] === 'editText' && !/执行中|完成|失败/.test(c[3]));
  assert.equal(bodySends.length, 1, '工具后正文不应发出第二条消息');
  assert.equal(bodyEdits.at(-1)[3], '已删除 X。', '补全应编辑进同一条正文消息');
  assert.equal(stream.text, '已删除 X。');
});

test('accumulates text-delta chunks and edits one message', async () => {
  const transport = makeTransport();
  // now 固定 → 首次 flush 立即，之后同一时刻不重复；finalize 强制刷新剩余
  let clock = 0;
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => clock });
  await stream.handleEvent({
    type: 'assistant/chunk',
    data: { chunk: { type: 'text-delta', index: 0, text: 'Hello' } },
  });
  clock += 2000;
  await stream.handleEvent({
    type: 'assistant/chunk',
    data: { chunk: { type: 'text-delta', index: 0, text: ' world' } },
  });
  await stream.finalize();
  const sends = transport.calls.filter((c) => c[0] === 'sendText');
  const edits = transport.calls.filter((c) => c[0] === 'editText');
  assert.equal(sends.length, 1);
  assert.equal(sends[0][2], 'Hello');
  assert.ok(edits.length >= 1);
  assert.equal(edits.at(-1)[3], 'Hello world');
  assert.equal(stream.text, 'Hello world');
});

test('ignores reasoning-delta chunks', async () => {
  const transport = makeTransport();
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => 0 });
  await stream.handleEvent({
    type: 'assistant/chunk',
    data: { chunk: { type: 'reasoning-delta', index: 0, text: '思考中' } },
  });
  await stream.finalize();
  assert.equal(transport.calls.length, 0);
  assert.equal(stream.text, '');
});

test('opens a running tool card and finalizes it on result', async () => {
  const transport = makeTransport();
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => 0 });
  await stream.handleEvent({ type: 'tool/call', data: { callId: 'c1', name: 'bash' } });
  await stream.handleEvent({ type: 'tool/result', data: { callId: 'c1' } });
  const card = transport.calls.find((c) => c[0] === 'sendCard');
  const done = transport.calls.find((c) => c[0] === 'editText');
  assert.match(card[2], /bash/);
  assert.match(card[2], /执行中/);
  assert.match(card[2], /^<blockquote>/, '工具卡片应为 blockquote 面板');
  assert.match(done[3], /bash/);
  assert.match(done[3], /完成/);
  assert.match(done[3], /^<blockquote>/, '定稿后仍是 blockquote 面板');
});

test('marks a tool card as failed when result carries an error', async () => {
  const transport = makeTransport();
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => 0 });
  await stream.handleEvent({ type: 'tool/call', data: { callId: 'c2', name: 'read' } });
  await stream.handleEvent({ type: 'tool/result', data: { callId: 'c2', error: { name: 'ENOENT', code: 'x' } } });
  const done = transport.calls.find((c) => c[0] === 'editText');
  assert.match(done[3], /失败/);
  assert.match(done[3], /ENOENT/);
});

test('flushes accumulated text before opening a tool card', async () => {
  const transport = makeTransport();
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => 0 });
  await stream.handleEvent({
    type: 'assistant/chunk',
    data: { chunk: { type: 'text-delta', index: 0, text: '准备执行' } },
  });
  await stream.handleEvent({ type: 'tool/call', data: { callId: 'c3', name: 'bash' } });
  const order = transport.calls.map((c) => c[0]);
  const textSend = order.indexOf('sendText');
  const cardSend = order.indexOf('sendCard');
  assert.ok(textSend >= 0 && cardSend >= 0);
  assert.ok(textSend < cardSend, '正文应在工具卡片之前交付');
});

test('escapes HTML in tool names', async () => {
  const transport = makeTransport();
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => 0 });
  await stream.handleEvent({ type: 'tool/call', data: { callId: 'c4', name: '<script>' } });
  const card = transport.calls.find((c) => c[0] === 'sendCard');
  assert.ok(!card[2].includes('<script>'));
  assert.match(card[2], /&lt;script&gt;/);
});

test('sends body text as HTML', async () => {
  const transport = makeTransport();
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => 0 });
  await stream.handleEvent({
    type: 'assistant/chunk',
    data: { chunk: { type: 'text-delta', index: 0, text: '**hi** a<b' } },
  });
  await stream.finalize();
  const send = transport.calls.find((c) => c[0] === 'sendText');
  assert.equal(send[2], '<b>hi</b> a&lt;b');
  assert.deepEqual(send[3], { parseMode: 'HTML' });
});

test('falls back to plain text when HTML send fails', async () => {
  const calls = [];
  let id = 0;
  const transport = {
    async sendText(chatId, text, opts) {
      calls.push(['sendText', chatId, text, opts]);
      if (opts?.parseMode === 'HTML') throw new Error('400: bad entity');
      return { message_id: ++id };
    },
    async editText(chatId, messageId, text, opts) {
      calls.push(['editText', chatId, messageId, text, opts]);
    },
    async sendCard() {
      return { message_id: ++id };
    },
    async editCard() {},
  };
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => 0 });
  await stream.handleEvent({
    type: 'assistant/chunk',
    data: { chunk: { type: 'text-delta', index: 0, text: '**x**' } },
  });
  await stream.finalize();
  const sends = calls.filter((c) => c[0] === 'sendText');
  assert.equal(sends.length, 2, 'HTML 尝试失败后应再以纯文本重发');
  assert.equal(sends[1][2], '**x**');
  assert.equal(sends[1][3], undefined);
});
