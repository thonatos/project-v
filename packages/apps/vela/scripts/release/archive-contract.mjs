#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyArchiveDigest(file, expected, label) {
  const actual = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (actual !== expected)
    throw new Error(`${label} 归档 SHA-256 摘要不匹配: ${file}\n期望: ${expected}\n实际: ${actual}`);
  return actual;
}

export function verifyRequiredPaths(root, paths, label) {
  const base = path.resolve(root);
  for (const relative of paths) {
    const target = path.resolve(base, relative);
    let valid = target.startsWith(`${base}${path.sep}`);
    try {
      valid = valid && fs.statSync(target).isFile();
    } catch {
      valid = false;
    }
    if (!valid) {
      throw new Error(`已验证的 ${label} 归档缺少安全路径: ${relative}`);
    }
  }
}

function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'digest') {
    verifyArchiveDigest(rest[0], rest[1], rest[2]);
    return;
  }
  if (command === 'paths') {
    verifyRequiredPaths(rest[0], JSON.parse(rest[1]), rest[2]);
    return;
  }
  throw new Error('usage: archive-contract.mjs digest FILE SHA256 LABEL | paths ROOT JSON_PATHS LABEL');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
