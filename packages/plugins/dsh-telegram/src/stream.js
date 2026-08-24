import { StreamRenderer } from './message.js';
import { toMarkdownV2 } from './markdown.js';

// 把 Harness `session/event` 增量事件流转换为 Telegram 实时输出。
//
// 数据源（@deepseek-ai/dsh-session SessionEventMap，已查证）：
//   assistant/chunk  { chunk: StreamChunk }  —— text-delta 累积正文
//   tool/call        { callId, name, arguments } —— 打开工具状态卡片
//   tool/result      { callId?, message, error? } —— 定稿工具卡片
//   assistant/message{ message } —— 一个 step 的完整 assistant 消息（含非文本块）
//   turn/end         { reason } —— turn 收尾
//
// 正文用 StreamRenderer 编辑式刷新（4096 安全分片）。text-delta 非常密集，
// 这里做时间去抖，避免触发 Telegram editMessageText 频率限制（约 1 次/秒/chat）。
export class StreamSession {
  #transport;
  #chatId;
  #limit;
  #flushIntervalMs;
  #now;
  #renderer;
  #text = '';
  #pendingText = false;
  #lastFlush = Number.NEGATIVE_INFINITY;
  #flushTimer = null;
  #toolCards = new Map();
  #flushing = Promise.resolve();

  constructor({ transport, chatId, limit, flushIntervalMs = 1100, now = () => Date.now() }) {
    if (!transport || typeof transport.sendText !== 'function') {
      throw new TypeError('StreamSession requires a transport');
    }
    this.#transport = transport;
    this.#chatId = String(chatId);
    this.#limit = limit;
    this.#flushIntervalMs = flushIntervalMs;
    this.#now = now;
    this.#renderer = this.#makeRenderer();
  }

  // 正文渲染器：MarkdownV2 优先，转换或流式半截实体导致 400 时降级为纯文本。
  #makeRenderer() {
    return new StreamRenderer({
      limit: this.#limit,
      send: (part) => this.#sendRich(part),
      edit: (messageId, part) => this.#editRich(messageId, part),
    });
  }

  async #sendRich(part) {
    let sent;
    try {
      sent = await this.#transport.sendText(this.#chatId, toMarkdownV2(part), { parseMode: 'MarkdownV2' });
    } catch {
      sent = await this.#transport.sendText(this.#chatId, part);
    }
    return sent?.message_id ?? sent?.messageId ?? '';
  }

  async #editRich(messageId, part) {
    try {
      return await this.#transport.editText(this.#chatId, messageId, toMarkdownV2(part), { parseMode: 'MarkdownV2' });
    } catch {
      return this.#transport.editText(this.#chatId, messageId, part);
    }
  }

  // 消费一个 session 事件。返回 Promise 便于测试串行等待。
  async handleEvent(event) {
    const type = event?.type;
    const data = event?.data ?? {};
    if (type === 'assistant/chunk') return this.#onChunk(data.chunk);
    if (type === 'tool/call') return this.#onToolCall(data);
    if (type === 'tool/result') return this.#onToolResult(data);
    return undefined;
  }

  #onChunk(chunk) {
    if (chunk?.type !== 'text-delta' || !chunk.text) return undefined;
    this.#text += chunk.text;
    this.#pendingText = true;
    return this.#scheduleFlush();
  }

  #scheduleFlush() {
    if (this.#flushTimer) return undefined;
    const elapsed = this.#now() - this.#lastFlush;
    const wait = Math.max(0, this.#flushIntervalMs - elapsed);
    if (wait === 0) return this.#flush();
    this.#flushTimer = setTimeout(() => {
      this.#flushTimer = null;
      void this.#flush();
    }, wait);
    this.#flushTimer.unref?.();
    return undefined;
  }

  // 把累积文本刷到 Telegram（编辑式）。串行化，避免并发 edit 乱序。
  #flush() {
    if (!this.#pendingText) return this.#flushing;
    this.#pendingText = false;
    this.#lastFlush = this.#now();
    const snapshot = this.#text;
    this.#flushing = this.#flushing
      .then(() => this.#renderer.update(snapshot))
      .catch((error) => {
        console.error('[dsh-telegram] stream flush failed:', error);
      });
    return this.#flushing;
  }

  async #onToolCall({ callId, name }) {
    const id = String(callId ?? '');
    if (!id) return;
    // 工具开始前先定稿已累积的正文，让工具卡片排在其后。
    await this.#flushNow();
    const text = toolText(name, 'running');
    const sent = await this.#transport.sendCard(this.#chatId, text, { parseMode: 'HTML' });
    this.#toolCards.set(id, {
      messageId: String(sent?.message_id ?? sent?.messageId ?? ''),
      name: name ?? '工具',
    });
    // 工具输出后正文会另起一条消息：重置 renderer 游标。
    this.#resetRenderer();
  }

  async #onToolResult({ callId, error }) {
    const id = String(callId ?? '');
    const card = id ? this.#toolCards.get(id) : undefined;
    if (!card) return;
    this.#toolCards.delete(id);
    const text = toolText(card.name, error ? 'error' : 'done', error);
    try {
      await this.#transport.editText(this.#chatId, card.messageId, text, { parseMode: 'HTML' });
    } catch (caught) {
      console.error('[dsh-telegram] tool card update failed:', caught);
    }
  }

  #resetRenderer() {
    this.#renderer = this.#makeRenderer();
    this.#text = '';
    this.#pendingText = false;
  }

  // 立即刷新待定文本（清除去抖定时器）。工具卡片前、turn 收尾时调用。
  async #flushNow() {
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = null;
    }
    await this.#flush();
  }

  // turn 结束：刷完剩余文本，等待所有在途 edit 落地。
  async finalize() {
    await this.#flushNow();
    await this.#flushing;
  }

  // 主动停止（/stop）：定稿当前输出，不再接收后续增量。
  async dispose() {
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = null;
    }
    await this.#flush().catch(() => {});
    await this.#flushing.catch(() => {});
  }

  get text() {
    return this.#text;
  }
}

function toolText(name, phase, error) {
  const label = name ?? '工具';
  if (phase === 'running') return `🔧 <b>${escapeHtml(label)}</b> 执行中…`;
  if (phase === 'error') {
    const detail = error?.name ? `：${escapeHtml(String(error.name))}` : '';
    return `❌ <b>${escapeHtml(label)}</b> 失败${detail}`;
  }
  return `✅ <b>${escapeHtml(label)}</b> 完成`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
