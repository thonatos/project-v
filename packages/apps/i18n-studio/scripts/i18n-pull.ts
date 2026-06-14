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
 *      into the single nested `studio-ui` resource, and write it to
 *      `app/i18n/locales/<lang>/studio-ui.json` (2-space indent, sorted keys).
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

import { flatten, unflatten } from './i18n-flatten';
import { fillPlaceholders } from './i18n-sync-core';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, '..');
const LOCALES_DIR = path.join(APP_DIR, 'app', 'i18n', 'locales');
const META_FILE = path.join(LOCALES_DIR, '_meta.json');
// 源语言固定为 zh-cn(= generated 的 DEFAULT_LANG)。其本地 key 全集(由 extract 产出)
// 是「应存在 key」的基准:任何语种缺这些 key 时写占位,保证 bundle 完整、构建不缺 key。
const SOURCE_LANG = 'zh-cn';
// 唯一 namespace 文件名(= studio-ui.json)。
const NS_FILE = 'studio-ui.json';

config({ path: path.join(APP_DIR, '.env') });

const BASE_URL = process.env.STUDIO_BASE_URL?.replace(/\/+$/, '');
const NAMESPACE = process.env.STUDIO_NAMESPACE ?? 'studio-ui';

interface LocaleManifestEntry {
  code?: unknown;
  label?: unknown;
  englishLabel?: unknown;
  nativeLabel?: unknown;
}

interface LocaleMeta {
  label: string;
  englishLabel: string;
  nativeLabel: string | null;
}

/**
 * Recursively sort object keys so serialized output is diff-stable.
 */
function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Read the local source-language (`zh-cn`) `studio-ui.json` as a flat key→value
 * map. These keys are the authoritative "should-exist" set produced by
 * `i18next-cli extract` (i.e. the `t('common.key')` calls in source). Returns an
 * empty map if the source file is absent (first pull before any extract).
 */
function readSourceFlatKeys(): Record<string, string> {
  const srcFile = path.join(LOCALES_DIR, SOURCE_LANG, NS_FILE);
  if (!fs.existsSync(srcFile)) return {};
  return flatten(JSON.parse(fs.readFileSync(srcFile, 'utf8')));
}

async function main(): Promise<void> {
  if (!BASE_URL) {
    console.error('[pull] 缺少 STUDIO_BASE_URL，请在 .env 配置后重试');
    process.exit(1);
  }

  // 1) 拉取语种清单,决定支持哪些语种 + 元信息(不再硬编码)
  let manifest: { locales?: LocaleManifestEntry[] };
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
  const langs = locales.map((l) => l.code).filter((c): c is string => typeof c === 'string');
  if (langs.length === 0) {
    console.error('[pull] 清单未返回任何语种,终止');
    process.exit(1);
  }

  // 2) 回写元信息供 codegen 生成显示名
  fs.mkdirSync(LOCALES_DIR, { recursive: true });
  const metaOut: Record<string, LocaleMeta> = {};
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
  // 先捕获本地源语言 key 全集(extract 产物)作为「应存在 key」基准——必须在循环
  // 覆盖 zh-cn 文件之前读取。系统缺失的 key 会补占位:源语言用本地源文案(避免抹掉
  // 尚未 push 的词条),其余语种用空串。占位只写本地 bundle,不回写 studio。
  const sourceKeys = readSourceFlatKeys();
  let failed = false;
  for (const lang of langs) {
    try {
      const res = await fetch(`${BASE_URL}/snapshot/${NAMESPACE}/${lang}`);
      if (!res.ok) {
        failed = true;
        console.error(`[pull] ${lang}: HTTP ${res.status} — ${await res.text()}`);
        continue;
      }
      const systemFlat = (await res.json()) as Record<string, string>;

      // 补占位:本地源 key 在系统该语种缺失时填充,保证构建不缺 key。
      const { merged: flatMap, placeholders } = fillPlaceholders(systemFlat, sourceKeys, lang, SOURCE_LANG);

      // 单 ns:unflatten 直接得到 studio-ui.json 的嵌套内容,写入单文件。
      const content = unflatten(flatMap);
      const langDir = path.join(LOCALES_DIR, lang);
      fs.mkdirSync(langDir, { recursive: true });

      const totalKeys = Object.keys(flatMap).length;
      const sorted = sortKeysDeep(content);
      fs.writeFileSync(path.join(langDir, NS_FILE), `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

      const phNote = placeholders > 0 ? `,补占位 ${placeholders}` : '';
      console.log(`[pull] ${lang}: 写入 ${NS_FILE} 共 ${totalKeys} 条${phNote}`);
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
