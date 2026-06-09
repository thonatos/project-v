/**
 * Push local i18next resources → studio `studio-ui` namespace via the import
 * API, authenticated with a `write` scope token.
 *
 * Run: `pnpm -F i18n-studio i18n:push` (cwd is the app dir under pnpm -F).
 *
 * Reads local `app/i18n/locales/<lang>/*.json`, flattens each lang's namespaces
 * into studio flat keys (`<ns>.<nested.path>`), and POSTs one import request per
 * locale. Any non-2xx response (or missing credentials) results in a non-zero
 * exit code — failures are never silent.
 *
 * Config (via dotenv from `packages/apps/i18n-studio/.env`):
 *   STUDIO_BASE_URL    studio service origin (no trailing slash)
 *   STUDIO_NAMESPACE   target namespace slug (default: studio-ui)
 *   STUDIO_WRITE_TOKEN write-scope token (wr_ prefix)
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

import { flatten } from './i18n-flatten.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, '..');
const LOCALES_DIR = path.join(APP_DIR, 'app', 'i18n', 'locales');

// Load .env from the app dir explicitly so the script works regardless of cwd.
config({ path: path.join(APP_DIR, '.env') });

const BASE_URL = process.env.STUDIO_BASE_URL?.replace(/\/+$/, '');
const NAMESPACE = process.env.STUDIO_NAMESPACE ?? 'studio-ui';
const TOKEN = process.env.STUDIO_WRITE_TOKEN;

/**
 * Read every `<ns>.json` under a language directory into a ns map.
 *
 * @param {string} langDir absolute path to `locales/<lang>`
 * @returns {Record<string, Record<string, unknown>>}
 */
function readLangNsMap(langDir) {
  /** @type {Record<string, Record<string, unknown>>} */
  const nsMap = {};
  const files = fs.readdirSync(langDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const ns = path.basename(file, '.json');
    const raw = fs.readFileSync(path.join(langDir, file), 'utf8');
    nsMap[ns] = JSON.parse(raw);
  }
  return nsMap;
}

async function main() {
  if (!BASE_URL) {
    console.error('[push] 缺少 STUDIO_BASE_URL，请在 .env 配置后重试');
    process.exit(1);
  }
  if (!TOKEN) {
    console.error('[push] 缺少 STUDIO_WRITE_TOKEN，请在 .env 配置 write token 后重试');
    process.exit(1);
  }
  if (!fs.existsSync(LOCALES_DIR)) {
    console.error(`[push] 本地资源目录不存在: ${LOCALES_DIR}`);
    process.exit(1);
  }

  const langs = fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  if (langs.length === 0) {
    console.error(`[push] ${LOCALES_DIR} 下没有语言目录`);
    process.exit(1);
  }

  let failed = false;
  for (const lang of langs) {
    const nsMap = readLangNsMap(path.join(LOCALES_DIR, lang));
    const entries = flatten(nsMap);
    const count = Object.keys(entries).length;
    try {
      const res = await fetch(`${BASE_URL}/api/namespaces/${NAMESPACE}/import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locale: lang, entries }),
      });
      const text = await res.text();
      if (!res.ok) {
        failed = true;
        console.error(`[push] ${lang}: HTTP ${res.status} — ${text}`);
        continue;
      }
      /** @type {{ imported?: number; total?: number; errors?: unknown[] } | null} */
      let body = null;
      try {
        const parsed = JSON.parse(text);
        body = parsed?.data ?? parsed;
      } catch {
        body = null;
      }
      const imported = body?.imported ?? count;
      console.log(`[push] ${lang}: 导入 ${imported}/${count} 条 → ${NAMESPACE}`);
      if (body?.errors && body.errors.length > 0) {
        failed = true;
        console.error(`[push] ${lang}: ${body.errors.length} 条失败 — ${JSON.stringify(body.errors)}`);
      }
    } catch (err) {
      failed = true;
      console.error(`[push] ${lang}: 请求失败 — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (failed) {
    console.error('[push] 存在失败项，退出码非零');
    process.exit(1);
  }
  console.log('[push] 完成');
}

void main();
