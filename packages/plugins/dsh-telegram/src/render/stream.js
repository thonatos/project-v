import { StreamRenderer } from './renderer.js';
import { markdownToHtml, stripImageMarkdown } from './html.js';
import { toolCard } from './cards.js';

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
  // 当前文本块在 #text 中的起始偏移。block-start 时记录，block-end 时用块的
  // 权威全文覆盖本块区间（见 #onBlockEnd），从而兼容「无 text-delta」的整块投递。
  #blockBaseLen = 0;
  // 事件处理串行队列。runtime 用 `void handleEvent(event)` fire-and-forget 投递，
  // 事件间不 await；真实网络延迟下 tool/call、text-delta、tool/result 的 async
  // 处理体会并发交错（resetRenderer 与 flush、卡片定稿相互穿插），导致正文重复、
  // 工具卡片卡在“执行中”。这里把每次 handleEvent 串到一条链上，保证按到达顺序处理。
  #queue = Promise.resolve();

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

  // 正文渲染器：HTML 优先，转换或流式半截标签导致 400 时降级为纯文本。
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
      sent = await this.#transport.sendText(this.#chatId, markdownToHtml(part), { parseMode: 'HTML' });
    } catch {
      // 纯文本降级也要剥掉 markdown 图片语法，避免残留 `![](...)` 噪声。
      sent = await this.#transport.sendText(this.#chatId, stripImageMarkdown(part));
    }
    return sent?.message_id ?? sent?.messageId ?? '';
  }

  async #editRich(messageId, part) {
    try {
      return await this.#transport.editText(this.#chatId, messageId, markdownToHtml(part), { parseMode: 'HTML' });
    } catch {
      return this.#transport.editText(this.#chatId, messageId, stripImageMarkdown(part));
    }
  }

  // 消费一个 session 事件。串行化到 #queue：即使调用方 fire-and-forget 并发投递，
  // 事件也按到达顺序逐个处理，返回的 Promise 在该事件处理完成后 resolve。
  handleEvent(event) {
    const run = this.#queue.then(() => this.#dispatch(event));
    // 吞掉链上的 rejection，避免一个事件出错拖垮后续事件的排队。
    this.#queue = run.catch(() => {});
    return run;
  }

  #dispatch(event) {
    const type = event?.type;
    const data = event?.data ?? {};
    if (type === 'assistant/chunk') return this.#onChunk(data.chunk);
    if (type === 'tool/call') return this.#onToolCall(data);
    if (type === 'tool/result') return this.#onToolResult(data);
    return undefined;
  }

  #onChunk(chunk) {
    const kind = chunk?.type;
    if (kind === 'block-start') return this.#onBlockStart(chunk);
    if (kind === 'block-end') return this.#onBlockEnd(chunk);
    if (kind !== 'text-delta' || !chunk.text) return undefined;
    this.#text += chunk.text;
    this.#pendingText = true;
    return this.#scheduleFlush();
  }

  // 文本块开始：记录该块在 #text 中的起点，供 block-end 覆盖对账。
  #onBlockStart(chunk) {
    if (chunk?.blockType === 'text') this.#blockBaseLen = this.#text.length;
    return undefined;
  }

  // 文本块结束：用块的权威全文覆盖本块区间。
  // 关键兼容点：许多回复（尤其工具调用后的短回复）不发 text-delta，只在 block-end
  // 一次性带上整块 block.text。若只处理 text-delta，正文就会整段丢失（web 由
  // 完整 assistant/message 渲染仍正常，但 Telegram 收不到）。这里以 block.text 为准
  // 覆盖 [#blockBaseLen, 末尾)：有 delta 时是幂等替换，无 delta 时补齐整段正文。
  #onBlockEnd(chunk) {
    if (chunk?.block?.type !== 'text') return undefined;
    const full = chunk.block.text ?? '';
    const base = Math.min(this.#blockBaseLen, this.#text.length);
    this.#text = this.#text.slice(0, base) + full;
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
    // 先剥掉 markdown 图片语法再交给 renderer：本地图片作为独立 photo 单独发送，
    // 正文不应残留 `![](...)`。在此剥离（而非仅在 #sendRich）可让 renderer 基于干净
    // 文本分片/diff，并使「仅图片、无文字」的回复剥离后为空 → 整体不发空消息。
    const snapshot = stripImageMarkdown(this.#text).trim();
    if (!snapshot) return this.#flushing;
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
    const text = toolCard(name, 'running');
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
    const text = toolCard(card.name, error ? 'error' : 'done', error);
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
    this.#blockBaseLen = 0;
  }

  // 立即刷新待定文本（清除去抖定时器）。工具卡片前、turn 收尾时调用。
  async #flushNow() {
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = null;
    }
    await this.#flush();
  }

  // turn 结束：先排空事件队列，再刷完剩余文本，等待所有在途 edit 落地。
  async finalize() {
    await this.#queue;
    await this.#flushNow();
    await this.#flushing;
  }

  // 主动停止（/stop）：定稿当前输出，不再接收后续增量。
  async dispose() {
    await this.#queue.catch(() => {});
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
