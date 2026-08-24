export function splitMessageText(value, limit) {
  const text = typeof value === 'string' ? value : '';
  if (!text) return [];
  const chunks = [];
  let offset = 0;
  while (text.length - offset > limit) {
    let end = offset + limit;
    const newline = text.lastIndexOf('\n', end);
    const space = text.lastIndexOf(' ', end);
    if (newline > offset + Math.floor(limit * 0.55)) end = newline;
    else if (space > offset + Math.floor(limit * 0.55)) end = space;
    if (end <= offset) end = offset + limit;
    if (isHighSurrogate(text.charCodeAt(end - 1))) end -= 1;
    chunks.push(text.slice(offset, end));
    offset = end;
    while (text[offset] === '\n' || text[offset] === ' ') offset += 1;
  }
  if (offset < text.length) chunks.push(text.slice(offset));
  return chunks;
}

function isHighSurrogate(value) {
  return value >= 0xd800 && value <= 0xdbff;
}

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

export function normalizeInboundMessage(message, { loadMedia } = {}) {
  const text = message?.message ?? '';
  const photo = message?.photo;
  const document = message?.document;
  const documentIsImage =
    typeof document?.mimeType === 'string'
      ? document.mimeType.startsWith('image/')
      : typeof document?.mime_type === 'string' && document.mime_type.startsWith('image/');
  const media = photo || (documentIsImage ? document : undefined);
  if (!text && !media) return null;
  return {
    text,
    media: media
      ? {
          kind: 'image',
          name: document?.fileName ?? document?.file_name ?? 'telegram-file',
          mimeType: document?.mimeType ?? document?.mime_type,
          load: loadMedia ? () => loadMedia(message) : undefined,
        }
      : undefined,
  };
}

export function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('');
}
