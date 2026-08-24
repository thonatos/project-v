import test from 'node:test';
import assert from 'node:assert/strict';
import { StreamSession } from '../src/stream.js';

function makeTransport() {
  const calls = [];
  let id = 0;
  return {
    calls,
    async sendText(chatId, text, opts) { calls.push(['sendText', chatId, text, opts]); return { message_id: ++id }; },
    async editText(chatId, messageId, text, opts) { calls.push(['editText', chatId, messageId, text, opts]); },
    async sendCard(chatId, text) { calls.push(['sendCard', chatId, text]); return { message_id: ++id }; },
    async editCard(chatId, messageId, markup) { calls.push(['editCard', chatId, messageId, markup]); },
  };
}

test('accumulates text-delta chunks and edits one message', async () => {
  const transport = makeTransport();
  // now 固定 → 首次 flush 立即，之后同一时刻不重复；finalize 强制刷新剩余
  let clock = 0;
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => clock });
  await stream.handleEvent({ type: 'assistant/chunk', data: { chunk: { type: 'text-delta', index: 0, text: 'Hello' } } });
  clock += 2000;
  await stream.handleEvent({ type: 'assistant/chunk', data: { chunk: { type: 'text-delta', index: 0, text: ' world' } } });
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
  await stream.handleEvent({ type: 'assistant/chunk', data: { chunk: { type: 'reasoning-delta', index: 0, text: '思考中' } } });
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
  assert.match(done[3], /bash/);
  assert.match(done[3], /完成/);
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
  await stream.handleEvent({ type: 'assistant/chunk', data: { chunk: { type: 'text-delta', index: 0, text: '准备执行' } } });
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

test('sends body text as MarkdownV2', async () => {
  const transport = makeTransport();
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => 0 });
  await stream.handleEvent({ type: 'assistant/chunk', data: { chunk: { type: 'text-delta', index: 0, text: '**hi** a.b' } } });
  await stream.finalize();
  const send = transport.calls.find((c) => c[0] === 'sendText');
  assert.equal(send[2], '*hi* a\\.b');
  assert.deepEqual(send[3], { parseMode: 'MarkdownV2' });
});

test('falls back to plain text when MarkdownV2 send fails', async () => {
  const calls = [];
  let id = 0;
  const transport = {
    async sendText(chatId, text, opts) {
      calls.push(['sendText', chatId, text, opts]);
      if (opts?.parseMode === 'MarkdownV2') throw new Error('400: bad entity');
      return { message_id: ++id };
    },
    async editText(chatId, messageId, text, opts) { calls.push(['editText', chatId, messageId, text, opts]); },
    async sendCard() { return { message_id: ++id }; },
    async editCard() {},
  };
  const stream = new StreamSession({ transport, chatId: '7', limit: 4096, now: () => 0 });
  await stream.handleEvent({ type: 'assistant/chunk', data: { chunk: { type: 'text-delta', index: 0, text: 'x_y' } } });
  await stream.finalize();
  const sends = calls.filter((c) => c[0] === 'sendText');
  assert.equal(sends.length, 2, 'MarkdownV2 尝试失败后应再以纯文本重发');
  assert.equal(sends[1][2], 'x_y');
  assert.equal(sends[1][3], undefined);
});
