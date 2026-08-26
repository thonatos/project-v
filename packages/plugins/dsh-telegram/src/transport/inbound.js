// 入站消息归一化与文本分片工具。

// 按 Telegram 单条上限把长文本切成多片：优先在换行/空格等安全边界断开，
// 避免截断 Unicode 代理对，也不生成超过 limit 的分片。
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

// 把 Telegram 入站消息归一化为 { text, media } 结构；纯图片也保留（不因缺文本丢弃）。
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
