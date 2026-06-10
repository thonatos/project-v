/**
 * Pull studio `studio-ui` namespace → local i18next resources.
 *
 * Run: `pnpm -F i18n-studio i18n:pull` (cwd is the app dir under pnpm -F).
 *
 * Flow:
 *   1. GET `${BASE_URL}/snapshot/${NS}/meta` → locale manifest. The supported
 *      language set is NOT hardcoded here; it is whatever the namespace reports.
 *   2. Write per-lang display metadata to `app/i18n/locales/_meta.json` (consumed
 *      by `i18n:codegen` to build display names).
 *   3. For each manifest lang, GET `${BASE_URL}/snapshot/${NS}/${lang}` (public —
 *      `studio-ui` has public_read=1, so no token is needed), restore flat keys
 *      into nested i18next namespaces, and write each ns to
 *      `app/i18n/locales/<lang>/<ns>.json` (2-space indent, sorted keys).
 * Any failure results in a non-zero exit code. After pulling, run `i18n:codegen`.
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
const META_FILE = path.join(LOCALES_DIR, '_meta.json');

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

  // 1) 拉取语种清单,决定支持哪些语种 + 元信息(不再硬编码)
  let manifest;
  try {
    const res = await fetch(`${BASE_URL}/snapshot/${NAMESPACE}/meta`);
    if (!res.ok) {
      console.error(`[pull] 清单接口 HTTP ${res.status} — ${await res.text()}`);
      process.exit(1);
    }
    manifest = await res.json();
  } catch (err) {
    console.error(`[pull] 拉取语种清单失败 — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const locales = Array.isArray(manifest?.locales) ? manifest.locales : [];
  const langs = locales.map((l) => l.code).filter((c) => typeof c === 'string');
  if (langs.length === 0) {
    console.error('[pull] 清单未返回任何语种,终止');
    process.exit(1);
  }

  // 2) 回写元信息供 codegen 生成显示名
  fs.mkdirSync(LOCALES_DIR, { recursive: true });
  /** @type {Record<string, { label: string; englishLabel: string; nativeLabel: string | null }>} */
  const metaOut = {};
  for (const l of locales) {
    if (typeof l?.code !== 'string') continue;
    metaOut[l.code] = {
      label: typeof l.label === 'string' ? l.label : l.code,
      englishLabel: typeof l.englishLabel === 'string' ? l.englishLabel : l.code,
      nativeLabel: typeof l.nativeLabel === 'string' ? l.nativeLabel : null,
    };
  }
  fs.writeFileSync(META_FILE, `${JSON.stringify(sortKeysDeep(metaOut), null, 2)}\n`, 'utf8');
  console.log(`[pull] 清单: ${langs.join(', ')} → 写入 _meta.json`);

  // 3) 逐语种拉取文案
  let failed = false;
  for (const lang of langs) {
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
  console.log('[pull] 完成,请运行 pnpm i18n:codegen 重新生成 generated.ts');
}

void main();
