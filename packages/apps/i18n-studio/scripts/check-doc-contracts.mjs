#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOC_ROOTS = [path.join(ROOT, 'README.md'), path.join(ROOT, 'app/docs')];

function collectFiles(target) {
  const stat = statSync(target);
  if (stat.isFile()) return [target];
  const out = [];
  for (const name of readdirSync(target)) {
    const child = path.join(target, name);
    const childStat = statSync(child);
    if (childStat.isDirectory()) out.push(...collectFiles(child));
    if (childStat.isFile() && /\.(md|mdx)$/.test(name)) out.push(child);
  }
  return out;
}

const files = DOC_ROOTS.flatMap(collectFiles);
const violations = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  if (text.includes('/healthz')) {
    violations.push(`${rel}: must not document /healthz`);
  }
  if (/token.{0,40}(过期时间|expiresAt|expiration|expire)/i.test(text)) {
    violations.push(`${rel}: must not claim API tokens support expiration`);
  }
  if (/task token.{0,80}(一次性|only.*once)/i.test(text)) {
    violations.push(`${rel}: must not claim task tokens are shown only once`);
  }
  if (/CMD.{0,80}(migrate|db:migrate|drizzle)/i.test(text)) {
    violations.push(`${rel}: must not describe container CMD as running migrations`);
  }
}

if (violations.length > 0) {
  console.error('Documentation contract violations:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log('✓ documentation contracts passed');
}
