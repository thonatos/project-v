import { eq, and, sql } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { entries, translations, namespaces } from '~/db/schema';
import { getNamespaceLocales } from '~/lib/services/namespace.server';
import { readReleaseRows } from '~/lib/services/release.server';
import { validateLocaleSubset } from '~/lib/validators';

export type ExportPayload = Record<string, string> | Record<string, Record<string, string>>;

export interface ExportInput {
  namespaceId: string;
  locale?: string[]; // 单 locale 平铺;多 locale 顶层分组
  atVersion?: number;
  bundleVersion?: number;
}

export function exportFlat(input: ExportInput): ExportPayload {
  const db = getDb();
  const ns = db.select().from(namespaces).where(eq(namespaces.id, input.namespaceId)).get();
  if (!ns) throw new Error('namespace not found');
  const allowed = getNamespaceLocales(ns);
  const target = input.locale && input.locale.length > 0 ? input.locale : allowed;
  const subset = validateLocaleSubset(target, allowed);
  if (!subset.ok) throw new Error(`未启用的 locale: ${subset.invalid.join(', ')}`);
  if (typeof input.atVersion === 'number' && typeof input.bundleVersion === 'number') {
    throw new Response(JSON.stringify({ code: 'conflicting_snapshot_params' }), { status: 422 });
  }

  // 仅 published
  type Row = { key: string; locale: string; value: string };
  const localeList = target.map((l) => `'${l.replace(/'/g, "''")}'`).join(',');
  const nsId = input.namespaceId.replace(/'/g, "''");

  let rows: Row[];
  if (typeof input.bundleVersion === 'number') {
    const releaseRows = readReleaseRows({
      namespaceId: input.namespaceId,
      bundleVersion: input.bundleVersion,
      locales: target,
    });
    if (!releaseRows) {
      throw new Response(JSON.stringify({ code: 'release_not_found', bundleVersion: input.bundleVersion }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    rows = releaseRows.rows.map((r) => ({ key: r.key, locale: r.locale, value: r.value }));
  } else if (typeof input.atVersion === 'number') {
    const sqlText = `
      WITH ranked AS (
        SELECT e.key AS key, tv.locale AS locale, tv.value AS value, tv.version,
               ROW_NUMBER() OVER (PARTITION BY tv.entry_id, tv.locale ORDER BY tv.version DESC) AS rn
        FROM translation_versions tv
        INNER JOIN entries e ON e.id = tv.entry_id
        WHERE e.namespace_id = '${nsId}'
          AND tv.locale IN (${localeList})
          AND tv.version <= ${input.atVersion}
          AND tv.status = 'published'
      )
      SELECT key, locale, value FROM ranked WHERE rn = 1
    `;
    rows = db.all(sql.raw(sqlText)) as Row[];
  } else {
    rows = db
      .select({ key: entries.key, locale: translations.locale, value: translations.value })
      .from(translations)
      .innerJoin(entries, eq(entries.id, translations.entryId))
      .where(
        and(
          eq(entries.namespaceId, input.namespaceId),
          sql`${translations.locale} IN (${sql.raw(localeList)})`,
          sql`${translations.publishedVersion} IS NOT NULL`,
        ),
      )
      .all();
  }

  if (target.length === 1) {
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  const out: Record<string, Record<string, string>> = {};
  for (const l of target) out[l] = {};
  for (const r of rows) {
    out[r.locale]![r.key] = r.value;
  }
  return out;
}
