import { eq, and, desc, sql } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { translationVersions, translations, entries } from '~/db/schema';
import type { TranslationVersion } from '~/db/schema';
import { writeTranslationInTx } from '~/lib/services/entry.server';
import { createReleaseFromCurrent } from '~/lib/services/release.server';
import { writeAuditEvent } from '~/lib/services/audit.server';

export interface VersionListResult {
  versions: TranslationVersion[];
  currentPublishedVersion: number | null;
  nextCursor: number | null;
}

export interface EntryVersionListResult {
  versions: TranslationVersion[];
  currentPublishedByLocale: Record<string, number>;
  nextCursor: { createdAt: number; id: string } | null;
}

export function listEntryVersions(
  entryId: string,
  opts: { locale?: string; limit?: number; cursor?: { createdAt: number; id: string } | null } = {},
): EntryVersionListResult {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 100, 500);
  const conds = [eq(translationVersions.entryId, entryId)];
  if (opts.locale) conds.push(eq(translationVersions.locale, opts.locale));
  if (opts.cursor) {
    conds.push(
      sql`(${translationVersions.createdAt}, ${translationVersions.id}) < (${opts.cursor.createdAt}, ${opts.cursor.id})`,
    );
  }
  const rows = db
    .select()
    .from(translationVersions)
    .where(and(...conds))
    .orderBy(desc(translationVersions.createdAt), desc(translationVersions.id))
    .limit(limit + 1)
    .all();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? { createdAt: last.createdAt, id: last.id } : null;

  // currentPublishedByLocale: 当前 translations 表里每个 locale 的 publishedVersion
  const cur = db.select().from(translations).where(eq(translations.entryId, entryId)).all();
  const currentPublishedByLocale: Record<string, number> = {};
  for (const t of cur) {
    if (t.publishedVersion != null) currentPublishedByLocale[t.locale] = t.publishedVersion;
  }
  return { versions: page, currentPublishedByLocale, nextCursor };
}

export function listVersions(
  entryId: string,
  locale: string,
  opts: { limit?: number; cursor?: number | null } = {},
): VersionListResult {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 50, 200);
  const rows = db
    .select()
    .from(translationVersions)
    .where(
      and(
        eq(translationVersions.entryId, entryId),
        eq(translationVersions.locale, locale),
        opts.cursor ? sql`${translationVersions.version} < ${opts.cursor}` : undefined,
      ),
    )
    .orderBy(desc(translationVersions.version))
    .limit(limit + 1)
    .all();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.version : null;

  const cur = db
    .select()
    .from(translations)
    .where(and(eq(translations.entryId, entryId), eq(translations.locale, locale)))
    .get();

  return { versions: page, currentPublishedVersion: cur?.publishedVersion ?? null, nextCursor };
}

export function revert(entryId: string, locale: string, version: number, actorId: string): { newVersion: number } {
  const db = getDb();
  return db.transaction((tx) => {
    const target = tx
      .select()
      .from(translationVersions)
      .where(
        and(
          eq(translationVersions.entryId, entryId),
          eq(translationVersions.locale, locale),
          eq(translationVersions.version, version),
        ),
      )
      .get();
    if (!target) {
      throw new Response('version not found', { status: 404 });
    }
    if (target.status === 'discarded') {
      throw new Response('cannot revert to discarded version', { status: 400 });
    }
    const ctx: { bundleVersionBumped: boolean; bundleVersion?: number; namespaceId?: string } = {
      bundleVersionBumped: false,
    };
    const r = writeTranslationInTx(
      tx as unknown as ReturnType<typeof getDb>,
      {
        entryId,
        locale,
        value: target.value,
        source: 'revert',
        status: 'published',
        actorId,
        metadata: { restored_from: version },
      },
      ctx,
    );
    if (ctx.bundleVersionBumped && ctx.namespaceId && ctx.bundleVersion) {
      const release = createReleaseFromCurrent(tx as unknown as ReturnType<typeof getDb>, {
        namespaceId: ctx.namespaceId,
        bundleVersion: ctx.bundleVersion,
        actorId,
        source: 'revert',
        note: `Restored ${locale} from version ${version}`,
      });
      writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
        namespaceId: ctx.namespaceId,
        actorId,
        action: 'translation.revert',
        resourceType: 'translation_version',
        resourceId: target.id,
        metadata: {
          entryId,
          locale,
          restoredFrom: version,
          newVersion: r.version,
          releaseId: release.release.id,
          bundleVersion: ctx.bundleVersion,
        },
      });
    }
    return { newVersion: r.version };
  });
}

export function getEntryNamespaceId(entryId: string): string | null {
  const db = getDb();
  const e = db.select().from(entries).where(eq(entries.id, entryId)).get();
  return e?.namespaceId ?? null;
}
