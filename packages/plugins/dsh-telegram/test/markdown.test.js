import test from 'node:test';
import assert from 'node:assert/strict';
import { toMarkdownV2 } from '../src/markdown.js';

test('escapes literal special characters in plain text', () => {
  assert.equal(toMarkdownV2('a.b-c!d'), 'a\\.b\\-c\\!d');
});

test('converts standard bold to MarkdownV2 bold', () => {
  assert.equal(toMarkdownV2('**bold** text'), '*bold* text');
  assert.equal(toMarkdownV2('__bold__'), '*bold*');
});

test('converts single-asterisk italics', () => {
  assert.equal(toMarkdownV2('*em*'), '_em_');
});

test('keeps inline code and does not escape dot inside', () => {
  assert.equal(toMarkdownV2('run `a.b` now'), 'run `a.b` now');
});

test('does not escape specials inside inline code', () => {
  // 行内代码内部的 . - ! 等不转义，只转义 ` 与 \\
  assert.equal(toMarkdownV2('`a.b-c`'), '`a.b-c`');
});

test('wraps fenced code blocks with language', () => {
  const input = '```bash\npwd && ls\n```';
  assert.equal(toMarkdownV2(input), '```bash\npwd && ls\n```');
});

test('escapes path inside a fenced block only for backtick and backslash', () => {
  const input = '```\n/Users/example/workspace/labs/dsh-workspace\n```';
  assert.equal(toMarkdownV2(input), '```\n/Users/example/workspace/labs/dsh-workspace\n```');
});

test('demotes headings to bold', () => {
  assert.equal(toMarkdownV2('# Title'), '*Title*');
  assert.equal(toMarkdownV2('### Sub.head'), '*Sub\\.head*');
});

test('converts links and escapes label and url', () => {
  assert.equal(toMarkdownV2('[a.b](http://x.com/y)'), '[a\\.b](http://x.com/y)');
});

test('handles an unclosed fence best-effort without throwing', () => {
  const input = '```\ncode line';
  assert.equal(toMarkdownV2(input), '```\ncode line');
});
