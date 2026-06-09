/**
 * Seed the `studio-ui` namespace with the first batch of UI copy, idempotently.
 *
 * Run: `pnpm -F i18n-studio i18n:seed`
 *
 * Source of truth is the local i18next resources at `app/i18n/locales/<lang>/*.json`
 * (produced by the frontend). We flatten each lang's namespaces into studio flat
 * keys (`<ns>.<nested.path>`) and feed them through `importFlat` — the exact same
 * landing path the HTTP import route uses — so translation status (published) and
 * versioning stay consistent with normal imports. Re-running is idempotent:
 * `importFlat` upserts entries by (namespace_id, key) and appends a new published
 * version rather than duplicating entries.
 *
 * If the local resources don't exist yet, the script exits 0 with a hint: the
 * frontend worker must produce `app/i18n/locales/` first.
 *
 * Only touches `studio-ui` — other namespaces are never read or written.
 */
import path from 'node:path';
import fs from 'node:fs';

import { eq } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { users } from '~/db/schema';
import { getNamespaceBySlug } from '~/lib/services/namespace.server';
import { importFlat } from '~/lib/services/entry.server';
import { flatten } from '../../scripts/i18n-flatten.mjs';

const TARGET_SLUG = process.env.STUDIO_NAMESPACE ?? 'studio-ui';
const LOCALES_DIR = path.resolve('./app/i18n/locales');

interface SeedResult {
  locale: string;
  imported: number;
  total: number;
  errors: Array<{ key: string; reason: string }>;
}

function readLangNsMap(langDir: string): Record<string, Record<string, unknown>> {
  const nsMap: Record<string, Record<string, unknown>> = {};
  const files = fs.readdirSync(langDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const ns = path.basename(file, '.json');
    nsMap[ns] = JSON.parse(fs.readFileSync(path.join(langDir, file), 'utf8'));
  }
  return nsMap;
}

function main(): void {
  if (!fs.existsSync(LOCALES_DIR)) {
    console.log(`[seed] 本地资源目录不存在: ${LOCALES_DIR}`);
    console.log('[seed] 请先让 frontend 产出 app/i18n/locales/ 后再运行 seed。');
    process.exit(0);
  }

  const ns = getNamespaceBySlug(TARGET_SLUG);
  if (!ns) {
    console.error(`[seed] 找不到 namespace "${TARGET_SLUG}"，请先创建后重试。`);
    process.exit(1);
  }

  const db = getDb();
  const superuser = db.select().from(users).where(eq(users.isSuperuser, true)).get();
  if (!superuser) {
    console.error('[seed] 没有 superuser 用户，无法确定 actorId，请先创建超级用户。');
    process.exit(1);
  }

  const langs = fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  if (langs.length === 0) {
    console.log('[seed] locales 下没有语言目录，跳过。');
    process.exit(0);
  }

  const results: SeedResult[] = [];
  let failed = false;
  for (const lang of langs) {
    const entries = flatten(readLangNsMap(path.join(LOCALES_DIR, lang)));
    const r = importFlat({
      namespaceId: ns.id,
      locale: lang,
      entries,
      asDraft: false,
      actorId: superuser.id,
    });
    results.push({ locale: lang, imported: r.imported, total: r.total, errors: r.errors });
    if (!r.ok) failed = true;
  }

  for (const r of results) {
    console.log(`[seed] ${r.locale}: 灌入 ${r.imported}/${r.total} 条 → ${TARGET_SLUG}`);
    if (r.errors.length > 0) {
      console.error(`[seed] ${r.locale}: ${r.errors.length} 条失败 — ${JSON.stringify(r.errors)}`);
    }
  }

  if (failed) {
    console.error('[seed] 存在失败项，退出码非零');
    process.exit(1);
  }
  console.log('[seed] 完成');
}

main();
