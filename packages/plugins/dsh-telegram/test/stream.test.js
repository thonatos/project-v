import { test } from 'vite-plus/test';
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
    async deleteMessage(chatId, messageId) {
      calls.push(['deleteMessage', chatId, messageId]);
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
  assert.equal(stream.hasTextOutput, true);
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
  assert.equal(stream.hasTextOutput, false);
});

test('delivers a text block that arrives whole via block-end (no text-delta)', async () => {
  // 真机 bug：工具调用后的短回复不发 text-delta，只在 block-end 一次性带上整块正文。
  // 旧实现只处理 text-delta → Telegram 收不到正文（web 由完整 assistant/message 渲染仍正常）。
  const transport = makeTransport();
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => 0 });
  await stream.handleEvent({
    type: 'assistant/chunk',
    data: { chunk: { type: 'block-start', index: 0, blockType: 'text' } },
  });
  await stream.handleEvent({
    type: 'assistant/chunk',
    data: { chunk: { type: 'block-end', index: 0, block: { type: 'text', text: '已生成图片。' } } },
  });
  await stream.finalize();
  const sends = transport.calls.filter((c) => c[0] === 'sendText');
  assert.equal(sends.length, 1);
  assert.equal(sends[0][2], '已生成图片。');
  assert.equal(stream.text, '已生成图片。');
});

test('block-end reconciles with streamed deltas without duplicating', async () => {
  // delta 流式先累积，block-end 携带同一块权威全文 → 覆盖而非追加，避免正文翻倍。
  const transport = makeTransport();
  let clock = 0;
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => clock });
  await stream.handleEvent({
    type: 'assistant/chunk',
    data: { chunk: { type: 'block-start', index: 0, blockType: 'text' } },
  });
  await stream.handleEvent({
    type: 'assistant/chunk',
    data: { chunk: { type: 'text-delta', index: 0, text: 'Hello' } },
  });
  clock += 2000;
  await stream.handleEvent({
    type: 'assistant/chunk',
    data: { chunk: { type: 'block-end', index: 0, block: { type: 'text', text: 'Hello world' } } },
  });
  await stream.finalize();
  assert.equal(stream.text, 'Hello world');
  const edits = transport.calls.filter((c) => c[0] === 'editText');
  assert.equal(edits.at(-1)[3], 'Hello world');
});

test('reuses one ephemeral card for tool calls and deletes it on finalize', async () => {
  const transport = makeTransport();
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => 0 });
  await stream.handleEvent({ type: 'tool/call', data: { callId: 'c1', name: 'bash' } });
  await stream.handleEvent({ type: 'tool/result', data: { callId: 'c1' } });
  await stream.handleEvent({ type: 'tool/call', data: { callId: 'c2', name: 'read' } });
  await stream.handleEvent({ type: 'tool/result', data: { callId: 'c2' } });
  await stream.finalize();
  const card = transport.calls.find((c) => c[0] === 'sendCard');
  const edits = transport.calls.filter((c) => c[0] === 'editText');
  const deleted = transport.calls.find((c) => c[0] === 'deleteMessage');
  assert.equal(transport.calls.filter((c) => c[0] === 'sendCard').length, 1);
  assert.match(card[2], /bash/);
  assert.match(card[2], /任务执行中/);
  assert.match(card[2], /^<blockquote>/, '工具卡片应为 blockquote 面板');
  assert.ok(edits.some((call) => /read/.test(call[3])));
  assert.ok(edits.some((call) => /2 个工具调用已完成/.test(call[3])));
  assert.deepEqual(deleted, ['deleteMessage', '7', '1']);
});

test('marks a tool card as failed when result carries an error', async () => {
  const transport = makeTransport();
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => 0 });
  await stream.handleEvent({ type: 'tool/call', data: { callId: 'c2', name: 'read' } });
  await stream.handleEvent({ type: 'tool/result', data: { callId: 'c2', error: { name: 'ENOENT', code: 'x' } } });
  await stream.finalize();
  const done = transport.calls.filter((c) => c[0] === 'editText').at(-1);
  assert.match(done[3], /失败/);
  assert.match(done[3], /ENOENT/);
  assert.equal(
    transport.calls.some((c) => c[0] === 'deleteMessage'),
    false,
  );
});

test('deletes the ephemeral tool card when a stream is disposed', async () => {
  const transport = makeTransport();
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => 0 });
  await stream.handleEvent({ type: 'tool/call', data: { callId: 'c1', name: 'bash' } });
  await stream.dispose();
  assert.deepEqual(transport.calls.at(-1), ['deleteMessage', '7', '1']);
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
