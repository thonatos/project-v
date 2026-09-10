import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, markdownToHtml, stripImageMarkdown } from '../src/render/html.js';

test('escapes only & < > in plain text', () => {
  assert.equal(escapeHtml('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
  assert.equal(markdownToHtml('1 < 2 && 3 > 2'), '1 &lt; 2 &amp;&amp; 3 &gt; 2');
});

test('strips markdown image syntax, keeping surrounding text', () => {
  assert.equal(stripImageMarkdown('看图 ![柱状图](chart.png) 好'), '看图  好');
  assert.equal(stripImageMarkdown('![a](x.png "t")'), '');
  // markdownToHtml 不应把图片当成链接残留 `!` 前缀
  assert.equal(markdownToHtml('结果 ![柱状图](chart.png)'), '结果 ');
  // 普通链接不受影响
  assert.equal(markdownToHtml('[doc](https://x.io)'), '<a href="https://x.io">doc</a>');
});

test('renders local image links as caption text while preserving ordinary links', () => {
  assert.equal(
    markdownToHtml('已生成：[下载图片](./solid.png)，参考 [文档](https://example.com/docs)。'),
    '已生成：下载图片，参考 <a href="https://example.com/docs">文档</a>。',
  );
});

test('converts standard bold to <b>', () => {
  assert.equal(markdownToHtml('**bold** text'), '<b>bold</b> text');
  assert.equal(markdownToHtml('__bold__'), '<b>bold</b>');
});

test('converts single-asterisk italics to <i>', () => {
  assert.equal(markdownToHtml('*em*'), '<i>em</i>');
  assert.equal(markdownToHtml('_em_'), '<i>em</i>');
});

test('converts strikethrough to <s>', () => {
  assert.equal(markdownToHtml('~~gone~~'), '<s>gone</s>');
});

test('wraps inline code in <code> and escapes its content', () => {
  assert.equal(markdownToHtml('run `a.b` now'), 'run <code>a.b</code> now');
  assert.equal(markdownToHtml('`x < y`'), '<code>x &lt; y</code>');
});

test('does not parse markup inside inline code', () => {
  assert.equal(markdownToHtml('`**not bold**`'), '<code>**not bold**</code>');
});

test('wraps fenced code blocks with language class', () => {
  const input = '```bash\npwd && ls\n```';
  assert.equal(markdownToHtml(input), '<pre><code class="language-bash">pwd &amp;&amp; ls</code></pre>');
});

test('wraps a fenced block without language', () => {
  const input = '```\n/Users/example/workspace/labs\n```';
  assert.equal(markdownToHtml(input), '<pre><code>/Users/example/workspace/labs</code></pre>');
});

test('escapes html specials inside a fenced block', () => {
  const input = '```\nif (a < b && b > c) {}\n```';
  assert.equal(markdownToHtml(input), '<pre><code>if (a &lt; b &amp;&amp; b &gt; c) {}</code></pre>');
});

test('demotes headings to bold', () => {
  assert.equal(markdownToHtml('# Title'), '<b>Title</b>');
  assert.equal(markdownToHtml('### Sub head'), '<b>Sub head</b>');
});

test('converts links and escapes label and url', () => {
  assert.equal(markdownToHtml('[a & b](http://x.com/y)'), '<a href="http://x.com/y">a &amp; b</a>');
});

test('handles an unclosed fence best-effort without throwing', () => {
  const input = '```\ncode line';
  assert.equal(markdownToHtml(input), '<pre><code>code line</code></pre>');
});
