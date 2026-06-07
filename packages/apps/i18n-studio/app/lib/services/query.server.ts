import { eq, and, like, sql, desc } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { entries, translations, translationVersions, namespaces } from '~/db/schema';
import { getNamespaceLocales } from '~/lib/services/namespace.server';
import { validateLocaleSubset } from '~/lib/validators';

export type GroupMode = 'key' | 'locale';
export type IncludeMode = 'published' | 'draft' | 'both';
export type StatusFilter = 'all' | 'draft';

export interface ListEntriesQuery {
  prefix?: string;
  locale?: string[]; // 显式 locale 子集
  view?: 'all'; // 与 locale 互斥
  atVersion?: number; // 快照版本
  group?: GroupMode;
  include?: IncludeMode;
  status?: StatusFilter;
  pageSize?: number;
  cursor?: string | null;
}

export interface TranslationCell {
  value: string;
  version: number | null;
  missing?: boolean;
  draft?: { value: string; version: number };
}

export interface EntryView {
  id: string;
  key: string;
  description: string | null;
  translations: Record<string, TranslationCell>;
}

export interface ListEntriesResult {
  entries?: EntryView[];
  locales?: Record<string, Array<{ key: string; value: string; version: number | null; missing?: boolean }>>;
  page: { nextCursor: string | null };
}

const DEFAULT_PAGE_SIZE = 100;

export function listEntries(namespaceId: string, q: ListEntriesQuery): ListEntriesResult {
  const db = getDb();
  const ns = db.select().from(namespaces).where(eq(namespaces.id, namespaceId)).get();
  if (!ns) throw new Error('namespace not found');

  // 解析 locale 集合
  const allowedLocales = getNamespaceLocales(ns);
  if (q.view === 'all' && q.locale && q.locale.length > 0) {
    throw new Error('view=all 与 locale 互斥,请二选一');
  }
  let targetLocales: string[];
  if (q.view === 'all' || !q.locale || q.locale.length === 0) {
    targetLocales = allowedLocales;
  } else {
    const subset = validateLocaleSubset(q.locale, allowedLocales);
    if (!subset.ok) {
      throw new Error(`未启用的 locale: ${subset.invalid.join(', ')}`);
    }
    targetLocales = q.locale;
  }

  const include: IncludeMode = q.include ?? 'published';
  const statusFilter: StatusFilter = q.status ?? 'all';
  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, 1000);

  // 先按 prefix 取一批 entries
  const baseRows = db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.namespaceId, namespaceId),
        q.prefix ? like(entries.key, `${q.prefix}%`) : undefined,
        q.cursor ? sql`${entries.id} > ${q.cursor}` : undefined,
      ),
    )
    .orderBy(entries.id)
    .limit(pageSize + 1)
    .all();

  const hasMore = baseRows.length > pageSize;
  const rowsForPage = hasMore ? baseRows.slice(0, pageSize) : baseRows;
  const nextCursor = hasMore ? rowsForPage[rowsForPage.length - 1]!.id : null;

  // 为每个 entry 查 translations(快照 / 最新)
  const entryIds = rowsForPage.map((e) => e.id);
  if (entryIds.length === 0) {
    return q.group === 'locale'
      ? { locales: Object.fromEntries(targetLocales.map((l) => [l, []])), page: { nextCursor } }
      : { entries: [], page: { nextCursor } };
  }

  // 拿快照(若 atVersion 指定)或最新 translations 表
  type Row = { entryId: string; locale: string; value: string; version: number; status: string };

  const idList = entryIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
  const localeList = targetLocales.map((l) => `'${l.replace(/'/g, "''")}'`).join(',');

  let publishedRows: Row[] = [];
  let draftRows: Row[] = [];

  if (typeof q.atVersion === 'number') {
    // 快照视图:用 ROW_NUMBER 取 (entry_id, locale) ≤ atVersion 中 status='published' 最新一行
    const sqlText = `
      WITH ranked AS (
        SELECT entry_id, locale, value, version, status,
               ROW_NUMBER() OVER (PARTITION BY entry_id, locale ORDER BY version DESC) AS rn
        FROM translation_versions
        WHERE entry_id IN (${idList})
          AND locale IN (${localeList})
          AND version <= ${q.atVersion}
          AND status = 'published'
      )
      SELECT entry_id AS entryId, locale, value, version, status FROM ranked WHERE rn = 1
    `;
    publishedRows = db.all(sql.raw(sqlText)) as Row[];
  } else {
    // 最新 published 直接读 translations 表
    const cur = db
      .select({
        entryId: translations.entryId,
        locale: translations.locale,
        value: translations.value,
        version: translations.publishedVersion,
      })
      .from(translations)
      .where(
        and(
          sql`${translations.entryId} IN (${sql.raw(idList)})`,
          sql`${translations.locale} IN (${sql.raw(localeList)})`,
          sql`${translations.publishedVersion} IS NOT NULL`,
        ),
      )
      .all();
    publishedRows = cur.map((r) => ({
      entryId: r.entryId,
      locale: r.locale,
      value: r.value,
      version: r.version!,
      status: 'published',
    }));
  }

  if (include === 'draft' || include === 'both' || statusFilter === 'draft') {
    const sqlText = `
      WITH ranked AS (
        SELECT entry_id, locale, value, version, status,
               ROW_NUMBER() OVER (PARTITION BY entry_id, locale ORDER BY version DESC) AS rn
        FROM translation_versions
        WHERE entry_id IN (${idList})
          AND locale IN (${localeList})
          AND status = 'draft'
      )
      SELECT entry_id AS entryId, locale, value, version, status FROM ranked WHERE rn = 1
    `;
    draftRows = db.all(sql.raw(sqlText)) as Row[];
  }

  // 索引 published
  const pubIdx = new Map<string, Row>();
  for (const r of publishedRows) pubIdx.set(`${r.entryId}::${r.locale}`, r);
  const draftIdx = new Map<string, Row>();
  for (const r of draftRows) draftIdx.set(`${r.entryId}::${r.locale}`, r);

  // 过滤:status=draft 仅保留有 draft 的 entry
  let entriesToReturn = rowsForPage;
  if (statusFilter === 'draft') {
    const draftEntryIds = new Set(draftRows.map((r) => r.entryId));
    entriesToReturn = rowsForPage.filter((e) => draftEntryIds.has(e.id));
  }
  // 快照视图过滤:任一 locale 在 atVersion 之前都没有 published 写入则不返回
  if (typeof q.atVersion === 'number') {
    const present = new Set(publishedRows.map((r) => r.entryId));
    entriesToReturn = entriesToReturn.filter((e) => present.has(e.id));
  }

  if ((q.group ?? 'key') === 'locale') {
    const locales: Record<
      string,
      Array<{ key: string; value: string; version: number | null; missing?: boolean }>
    > = {};
    for (const l of targetLocales) locales[l] = [];
    for (const entry of entriesToReturn) {
      for (const l of targetLocales) {
        const pub = pubIdx.get(`${entry.id}::${l}`);
        const draft = draftIdx.get(`${entry.id}::${l}`);
        if (include === 'draft') {
          if (draft) {
            locales[l]!.push({ key: entry.key, value: draft.value, version: draft.version });
          } else {
            locales[l]!.push({ key: entry.key, value: '', version: null, missing: true });
          }
        } else if (include === 'both') {
          if (pub) locales[l]!.push({ key: entry.key, value: pub.value, version: pub.version });
          else locales[l]!.push({ key: entry.key, value: '', version: null, missing: !draft });
          // both 模式下 draft 通过 group=key 才方便表达;locale 桶中给当前生效优先
        } else {
          if (pub) {
            locales[l]!.push({ key: entry.key, value: pub.value, version: pub.version });
          } else {
            locales[l]!.push({ key: entry.key, value: '', version: null, missing: true });
          }
        }
      }
    }
    return { locales, page: { nextCursor } };
  }

  const out: EntryView[] = entriesToReturn.map((entry) => {
    const trans: Record<string, TranslationCell> = {};
    for (const l of targetLocales) {
      const pub = pubIdx.get(`${entry.id}::${l}`);
      const draft = draftIdx.get(`${entry.id}::${l}`);
      if (include === 'draft') {
        trans[l] = draft ? { value: draft.value, version: draft.version } : { value: '', version: null, missing: true };
      } else if (include === 'both') {
        trans[l] = pub ? { value: pub.value, version: pub.version } : { value: '', version: null, missing: !draft };
        if (draft) (trans[l] as TranslationCell).draft = { value: draft.value, version: draft.version };
      } else {
        trans[l] = pub ? { value: pub.value, version: pub.version } : { value: '', version: null, missing: true };
      }
    }
    return { id: entry.id, key: entry.key, description: entry.description, translations: trans };
  });
  return { entries: out, page: { nextCursor } };
}

export function getEntryDetail(namespaceId: string, key: string) {
  const db = getDb();
  const ns = db.select().from(namespaces).where(eq(namespaces.id, namespaceId)).get();
  if (!ns) return null;
  const entry = db
    .select()
    .from(entries)
    .where(and(eq(entries.namespaceId, namespaceId), eq(entries.key, key)))
    .get();
  if (!entry) return null;
  const trans = db.select().from(translations).where(eq(translations.entryId, entry.id)).all();
  const drafts = db
    .select()
    .from(translationVersions)
    .where(and(eq(translationVersions.entryId, entry.id), eq(translationVersions.status, 'draft')))
    .orderBy(desc(translationVersions.version))
    .all();
  return { entry, translations: trans, drafts };
}
