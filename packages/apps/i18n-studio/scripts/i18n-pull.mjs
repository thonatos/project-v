/**
 * Pull studio `studio-ui` namespace → local i18next resources.
 *
 * Run: `pnpm -F i18n-studio i18n:pull` (cwd is the app dir under pnpm -F).
 *
 * For each supported lang, GETs `${BASE_URL}/snapshot/${NS}/${lang}` (the public
 * snapshot — `studio-ui` has public_read=1, so no token is needed), restores the
 * flat keys into nested i18next namespaces, and writes each ns back to
 * `app/i18n/locales/<lang>/<ns>.json` (2-space indent, sorted keys for stable
 * diffs). Any failure results in a non-zero exit code.
 *
 * Config (via dotenv from `packages/apps/i18n-studio/.env`):
 *   STUDIO_BASE_URL  studio service origin (no trailing slash)
 *   STUDIO_NAMESPACE target namespace slug (default: studio-ui)
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

import { unflatten } from './i18n-flatten.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, '..');
const LOCALES_DIR = path.join(APP_DIR, 'app', 'i18n', 'locales');

// Supported UI languages (see design 决策 4). Real locale codes, not zh-CN/en.
const SUPPORTED_LANGS = ['zh-cn', 'en-us'];

config({ path: path.join(APP_DIR, '.env') });

const BASE_URL = process.env.STUDIO_BASE_URL?.replace(/\/+$/, '');
const NAMESPACE = process.env.STUDIO_NAMESPACE ?? 'studio-ui';

/**
 * Recursively sort object keys so serialized output is diff-stable.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function sortKeysDeep(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  /** @type {Record<string, unknown>} */
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortKeysDeep(/** @type {Record<string, unknown>} */ (value)[key]);
  }
  return sorted;
}

async function main() {
  if (!BASE_URL) {
    console.error('[pull] 缺少 STUDIO_BASE_URL，请在 .env 配置后重试');
    process.exit(1);
  }

  let failed = false;
  for (const lang of SUPPORTED_LANGS) {
    try {
      const res = await fetch(`${BASE_URL}/snapshot/${NAMESPACE}/${lang}`);
      if (!res.ok) {
        failed = true;
        console.error(`[pull] ${lang}: HTTP ${res.status} — ${await res.text()}`);
        continue;
      }
      /** @type {Record<string, string>} */
      const flatMap = await res.json();
      const nsMap = unflatten(flatMap);
      const langDir = path.join(LOCALES_DIR, lang);
      fs.mkdirSync(langDir, { recursive: true });

      let totalKeys = 0;
      const written = [];
      for (const [ns, content] of Object.entries(nsMap)) {
        const file = path.join(langDir, `${ns}.json`);
        const sorted = sortKeysDeep(content);
        fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
        const nsKeyCount = Object.keys(flatMap).filter((k) => k.startsWith(`${ns}.`)).length;
        totalKeys += nsKeyCount;
        written.push(`${ns}.json(${nsKeyCount})`);
      }
      console.log(`[pull] ${lang}: 写入 ${written.join(', ')} 共 ${totalKeys} 条`);
    } catch (err) {
      failed = true;
      console.error(`[pull] ${lang}: 拉取失败 — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (failed) {
    console.error('[pull] 存在失败项，退出码非零');
    process.exit(1);
  }
  console.log('[pull] 完成');
}

void main();
