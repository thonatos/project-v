import { splitMessageText } from '../transport/inbound.js';

// 增量流式渲染：首条消息发送后，随内容增长优先编辑最后一条消息；
// 超过 limit 时定稿当前片并发送下一片；编辑失败时降级为发送新消息。
// 已定稿（非最后一片）的分片内容保持不变，避免重发已确认内容。
export class StreamRenderer {
  #limit;
  #send;
  #edit;
  #chunks = [];

  constructor({ limit, send, edit }) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new TypeError('StreamRenderer requires a positive limit');
    if (typeof send !== 'function' || typeof edit !== 'function') {
      throw new TypeError('StreamRenderer requires send and edit callbacks');
    }
    this.#limit = limit;
    this.#send = send;
    this.#edit = edit;
  }

  get messageIds() {
    return this.#chunks.map((chunk) => chunk.id);
  }

  async update(fullText) {
    const parts = splitMessageText(fullText, this.#limit);
    if (parts.length === 0) return;
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (index < this.#chunks.length) {
        const chunk = this.#chunks[index];
        if (chunk.text === part) continue;
        try {
          await this.#edit(chunk.id, part);
          chunk.text = part;
        } catch {
          const id = await this.#send(part);
          this.#chunks[index] = { id: String(id ?? ''), text: part };
        }
      } else {
        const id = await this.#send(part);
        this.#chunks.push({ id: String(id ?? ''), text: part });
      }
    }
  }
}
