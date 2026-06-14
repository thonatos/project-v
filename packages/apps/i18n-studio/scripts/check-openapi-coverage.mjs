#!/usr/bin/env node
// 比对 app/routes/api.* 与 snapshot.* 文件 vs openapi.json 的 paths。
// Missing route documentation is a CI failure.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ROUTES_DIR = path.join(ROOT, 'app/routes');
const OPENAPI = path.join(ROOT, 'public/openapi.json');

function fileToPath(f) {
  // api.namespaces.$slug.entries.$key.publish.tsx → /api/namespaces/{slug}/entries/{key}/publish
  // snapshot.$slug.$locale.tsx → /snapshot/{slug}/{locale}
  // _index 表示父路径本身
  let s = f.replace(/\.tsx$/, '');
  if (s.endsWith('._index')) s = s.replace(/\._index$/, '');
  // dot to slash
  s = s.replace(/\./g, '/');
  // $foo → {foo}
  s = s.replace(/\$(\w+)/g, '{$1}');
  return '/' + s;
}

const files = readdirSync(ROUTES_DIR).filter(
  (f) => (f.startsWith('api.') || f.startsWith('snapshot.')) && f.endsWith('.tsx'),
);
const expected = new Set(files.map(fileToPath));

const openapi = JSON.parse(readFileSync(OPENAPI, 'utf8'));
const documented = new Set(Object.keys(openapi.paths ?? {}));

const missing = [...expected].filter((p) => !documented.has(p));
const extra = [...documented].filter((p) => !expected.has(p));

console.log(`Routes files: ${files.length}`);
console.log(`Documented paths: ${documented.size}`);

if (missing.length) {
  console.log('\n⚠ 缺 documentation 的路径:');
  for (const p of missing) console.log('  ' + p);
}
if (extra.length) {
  console.log('\nℹ openapi.json 中无对应文件的路径(允许,可能是同一文件多 method):');
  for (const p of extra) console.log('  ' + p);
}

if (missing.length === 0) {
  console.log('\n✓ 所有路由都已 documented');
} else {
  process.exitCode = 1;
}
