// 把模型输出的标准 Markdown 转成 Telegram 支持的受限 HTML。
//
// Telegram HTML 只认少量标签：<b> <i> <u> <s> <code> <pre> <a href>，
// 以及 <pre><code class="language-xx"> 形式的代码块。文本节点只需转义 & < >
// （属性值另转 "）。相比 MarkdownV2 的 18 个转义字符，容错面小得多。
//
// 覆盖：围栏代码块、行内代码、粗体、斜体、删除线、链接、标题（降级为粗体）。
// 流式分片可能出现未闭合的围栏/实体，转换结果对 Telegram 可能非法——调用方需在
// HTML 发送失败时降级为纯文本，故这里只求尽力而为，不追求边界完美。

import { stripLocalImageLinks } from './local-images.js';

// 剥离 markdown 图片语法 `![alt](src)`。
// Telegram 不渲染 markdown 图片，且本地图片会作为独立 photo 消息单独发送
// （见 runtime #sendLocalImages），正文里再留一个死的 `![](...)` 只会显示成
// 残缺文本（`[alt](src)` 会被链接规则误当成 <a>，前导 `!` 变成裸字符）。
// 因此在渲染/纯文本两条出站路径统一先剥掉图片标记，避免与独立图片重复且不残留噪声。
// 仅移除标记本身，保留前后文字与换行结构。
export function stripImageMarkdown(input) {
  const withoutImages = String(input ?? '').replace(/!\[[^\]]*\]\([^)\s]*(?:\s+"[^"]*")?\)/g, '');
  return stripLocalImageLinks(withoutImages);
}

// 文本节点转义：& < > 三个字符。
export function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// 属性值转义：在文本转义基础上再转 "。
function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', '&quot;');
}

// 处理一段非代码文本的行内标记：粗体、斜体、删除线、行内代码、链接；
// 其余字符走 escapeHtml。行内代码优先切出，避免其内部的 * _ 被误当标记。
function convertInlineMarkup(text) {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const slice = text.slice(index);
    let match;
    // 行内代码：`code`（内部不再解析其他标记，只转义）
    if ((match = /^`([^`]+)`/.exec(slice))) {
      out += `<code>${escapeHtml(match[1])}</code>`;
      index += match[0].length;
      continue;
    }
    // 链接：[text](url)
    if ((match = /^\[([^\]]*)\]\(([^)\s]+)\)/.exec(slice))) {
      out += `<a href="${escapeAttr(match[2])}">${convertInlineMarkup(match[1])}</a>`;
      index += match[0].length;
      continue;
    }
    // 粗体：**text** 或 __text__
    if ((match = /^\*\*([^*]+)\*\*/.exec(slice)) || (match = /^__([^_]+)__/.exec(slice))) {
      out += `<b>${convertInlineMarkup(match[1])}</b>`;
      index += match[0].length;
      continue;
    }
    // 删除线：~~text~~
    if ((match = /^~~([^~]+)~~/.exec(slice))) {
      out += `<s>${convertInlineMarkup(match[1])}</s>`;
      index += match[0].length;
      continue;
    }
    // 斜体：*text* 或 _text_（不跨行）
    if ((match = /^\*([^*\n]+)\*/.exec(slice)) || (match = /^_([^_\n]+)_/.exec(slice))) {
      out += `<i>${convertInlineMarkup(match[1])}</i>`;
      index += match[0].length;
      continue;
    }
    out += escapeHtml(text[index]);
    index += 1;
  }
  return out;
}

// 处理单行：标题降级为粗体，其余走行内标记转换。
function convertLine(line) {
  const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
  if (heading) return `<b>${convertInlineMarkup(heading[2])}</b>`;
  return convertInlineMarkup(line);
}

export function markdownToHtml(input) {
  const text = stripImageMarkdown(input);
  const lines = text.split('\n');
  const out = [];
  let inFence = false;
  let fenceLang = '';
  let fenceBuf = [];

  const flushFence = () => {
    const body = fenceBuf.map(escapeHtml).join('\n');
    const lang = fenceLang ? ` class="language-${escapeAttr(fenceLang)}"` : '';
    out.push(`<pre><code${lang}>${body}</code></pre>`);
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
        flushFence();
        inFence = false;
      }
      continue;
    }
    if (inFence) {
      fenceBuf.push(line);
      continue;
    }
    out.push(convertLine(line));
  }
  // 未闭合围栏：尽力而为地收尾，交付内容而非丢弃。
  if (inFence) flushFence();
  return out.join('\n');
}
