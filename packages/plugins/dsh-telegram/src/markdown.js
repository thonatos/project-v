// 把模型输出的标准 Markdown 转成 Telegram MarkdownV2。
//
// 两者语法不同：标准 Markdown 用 **bold**、# 标题、- 列表；MarkdownV2 用
// *bold*、无标题/列表语法，且所有字面特殊字符 _*[]()~`>#+-=|{}.!\ 必须转义。
// 覆盖：围栏代码块、行内代码、粗体、斜体、链接、标题（降级为粗体）；其余字符转义。
//
// 流式分片可能出现未闭合的围栏/实体，转换结果对 Telegram 可能非法——调用方需在
// MarkdownV2 发送失败时降级为纯文本，故这里只求尽力而为，不追求边界完美。

const TEXT_SPECIALS = /[_*[\]()~`>#+\-=|{}.!\\]/g;

// 正文（非代码）里的字面字符转义。
function escapeText(value) {
  return String(value).replace(TEXT_SPECIALS, '\\$&');
}

// 代码块/行内代码内部只需转义 \ 与 反引号。
function escapeCode(value) {
  return String(value).replace(/[`\\]/g, '\\$&');
}

// 链接 URL（括号内）只需转义 ) 与 \。
function escapeUrl(value) {
  return String(value).replace(/[)\\]/g, '\\$&');
}

// 处理粗体/斜体/链接，其余字符逐个转义。
function convertText(text) {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const slice = text.slice(index);
    let match;
    if ((match = /^\*\*([^*]+)\*\*/.exec(slice)) || (match = /^__([^_]+)__/.exec(slice))) {
      out += `*${escapeText(match[1])}*`;
      index += match[0].length;
      continue;
    }
    if ((match = /^\[([^\]]*)\]\(([^)]*)\)/.exec(slice))) {
      out += `[${escapeText(match[1])}](${escapeUrl(match[2])})`;
      index += match[0].length;
      continue;
    }
    if ((match = /^\*([^*\n]+)\*/.exec(slice)) || (match = /^_([^_\n]+)_/.exec(slice))) {
      out += `_${escapeText(match[1])}_`;
      index += match[0].length;
      continue;
    }
    out += escapeText(text[index]);
    index += 1;
  }
  return out;
}

// 处理一行内的行内标记（标题降级为粗体；先切出 `code` 片段，其余走 convertText）。
function convertInline(line) {
  const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
  if (heading) return `*${convertText(heading[2])}*`;

  const out = [];
  let rest = line;
  const codeRe = /`([^`]*)`/;
  let match;
  while ((match = codeRe.exec(rest))) {
    out.push(convertText(rest.slice(0, match.index)));
    out.push(`\`${escapeCode(match[1])}\``);
    rest = rest.slice(match.index + match[0].length);
  }
  out.push(convertText(rest));
  return out.join('');
}

export function toMarkdownV2(input) {
  const text = String(input ?? '');
  const lines = text.split('\n');
  const out = [];
  let inFence = false;
  let fenceLang = '';
  let fenceBuf = [];

  const flushFence = (closed) => {
    const lang = fenceLang ? escapeCode(fenceLang) : '';
    const body = fenceBuf.map(escapeCode).join('\n');
    out.push(closed ? `\`\`\`${lang}\n${body}\n\`\`\`` : `\`\`\`${lang}\n${body}`);
    fenceBuf = [];
    fenceLang = '';
  };

  for (const line of lines) {
    const fence = /^\s*```(.*)$/.exec(line);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceLang = fence[1].trim();
      } else {
        flushFence(true);
        inFence = false;
      }
      continue;
    }
    if (inFence) {
      fenceBuf.push(line);
      continue;
    }
    out.push(convertInline(line));
  }
  if (inFence) flushFence(false);
  return out.join('\n');
}
