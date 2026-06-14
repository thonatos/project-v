/**
 * Push newly-extracted source-language keys → studio namespace via the import
 * API, authenticated with a `write` scope token.
 *
 * Run: `pnpm -F i18n-studio i18n:push` (the `i18n:push` script runs
 * `i18n:extract` first so local `zh-cn` reflects the keys actually used in
 * source before this diff runs).
 *
 * Flow (源码是 key 的权威来源,详见 openspec 变更 i18n-studio-single-namespace):
 *   1. Read local source-language (`zh-cn`) `studio-ui.json` and flatten to
 *      studio flat keys (the full nested path, e.g. `common.nav.dashboard`).
 *      These keys come from `i18next-cli extract`, i.e. the `t('common.key')`
 *      calls in the code (single namespace `studio-ui`).
 *   2. GET `${BASE_URL}/snapshot/${NS}/zh-cn` to learn which keys the system
 *      ALREADY has, and diff: only keys absent in the system are "new".
 *   3. POST one import for `zh-cn` carrying ONLY the new keys (+ their local
 *      source text). Existing keys — and any human translations in other
 *      locales — are never touched by this script.
 *
 * Only the source language is pushed: translations for other locales are
 * produced by humans inside studio, then flow back via `i18n:pull`. Pushing
 * other locales here would clobber that work.
 *
 * Any non-2xx response (or missing credentials) results in a non-zero exit
 * code — failures are never silent.
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
import { diffNewEntries } from './i18n-sync-core.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, '..');
const LOCALES_DIR = path.join(APP_DIR, 'app', 'i18n', 'locales');
// 源语言固定为 zh-cn(= generated 的 DEFAULT_LANG)。
const SOURCE_LANG = 'zh-cn';
// 唯一 namespace 文件名(= studio-ui.json),与 STUDIO_NAMESPACE 对应。
const NS_FILE = 'studio-ui.json';

// Load .env from the app dir explicitly so the script works regardless of cwd.
config({ path: path.join(APP_DIR, '.env') });

const BASE_URL = process.env.STUDIO_BASE_URL?.replace(/\/+$/, '');
const NAMESPACE = process.env.STUDIO_NAMESPACE ?? 'studio-ui';
const TOKEN = process.env.STUDIO_WRITE_TOKEN;

/**
 * Read a language's single `studio-ui.json` into its nested object.
 *
 * @param {string} langDir absolute path to `locales/<lang>`
 * @returns {Record<string, unknown>}
 */
function readLangResource(langDir) {
  const raw = fs.readFileSync(path.join(langDir, NS_FILE), 'utf8');
  return JSON.parse(raw);
}

/**
 * Fetch the set of flat keys the system already has for the source language.
 * A 404 (namespace/locale not yet present) is treated as "no keys yet" so the
 * first push into a fresh namespace works.
 *
 * @param {string} lang source locale code
 * @returns {Promise<Set<string>>}
 */
async function fetchExistingKeys(lang) {
  const res = await fetch(`${BASE_URL}/snapshot/${NAMESPACE}/${lang}`);
  if (res.status === 404) return new Set();
  if (!res.ok) {
    throw new Error(`snapshot HTTP ${res.status} — ${await res.text()}`);
  }
  /** @type {Record<string, string>} */
  const flat = await res.json();
  return new Set(Object.keys(flat));
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
  const srcDir = path.join(LOCALES_DIR, SOURCE_LANG);
  if (!fs.existsSync(srcDir)) {
    console.error(`[push] 源语言资源目录不存在: ${srcDir}（先运行 pnpm i18n:extract）`);
    process.exit(1);
  }

  // 1) 本地源语言全部 key(来自 extract,即源码 t('common.key') 调用)
  const localEntries = flatten(readLangResource(srcDir));
  const localKeys = Object.keys(localEntries);
  if (localKeys.length === 0) {
    console.error(`[push] ${SOURCE_LANG} 无任何 key,终止`);
    process.exit(1);
  }

  // 2) 取系统现有 key,diff 出新增项
  let existing;
  try {
    existing = await fetchExistingKeys(SOURCE_LANG);
  } catch (err) {
    console.error(`[push] 拉取系统现有 key 失败 — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const newKeys = localKeys.filter((k) => !existing.has(k));
  if (newKeys.length === 0) {
    console.log(`[push] 系统已有全部 ${localKeys.length} 个 key,无新增,跳过`);
    return;
  }

  // 3) 仅推送新增 key 及其本地源文案到源语言;既有翻译不受影响
  const entries = diffNewEntries(localEntries, existing);

  try {
    const res = await fetch(`${BASE_URL}/api/namespaces/${NAMESPACE}/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locale: SOURCE_LANG, entries }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[push] ${SOURCE_LANG}: HTTP ${res.status} — ${text}`);
      process.exit(1);
    }
    /** @type {{ imported?: number; total?: number; errors?: unknown[] } | null} */
    let body = null;
    try {
      const parsed = JSON.parse(text);
      body = parsed?.data ?? parsed;
    } catch {
      body = null;
    }
    const imported = body?.imported ?? newKeys.length;
    console.log(
      `[push] ${SOURCE_LANG}: 新增 ${imported}/${newKeys.length} 个 key → ${NAMESPACE}（系统原有 ${existing.size} 个）`,
    );
    console.log(`[push] 新增 key: ${newKeys.join(', ')}`);
    if (body?.errors && body.errors.length > 0) {
      console.error(`[push] ${body.errors.length} 条失败 — ${JSON.stringify(body.errors)}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`[push] 请求失败 — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  console.log('[push] 完成');
}

void main();
