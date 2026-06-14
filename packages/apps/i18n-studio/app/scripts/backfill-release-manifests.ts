/**
 * Backfill one immutable release manifest for each namespace's current
 * published state.
 *
 * Run after the release tables migration:
 *   pnpm -F i18n-studio release:backfill
 *
 * The script is idempotent: if a namespace already has a release for its
 * current bundleVersion, it is skipped.
 */
import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { entries, namespaces, releaseItems, releases, translationVersions, translations } from '~/db/schema';

interface PublishedRow {
  entryId: string;
  key: string;
  locale: string;
  translationVersionId: string;
  translationVersionNumber: number;
  value: string;
}

function getPublishedRows(db: ReturnType<typeof getDb>, namespaceId: string): PublishedRow[] {
  return db
    .select({
      entryId: entries.id,
      key: entries.key,
      locale: translations.locale,
      translationVersionId: translationVersions.id,
      translationVersionNumber: translationVersions.version,
      value: translationVersions.value,
    })
    .from(translations)
    .innerJoin(entries, eq(entries.id, translations.entryId))
    .innerJoin(
      translationVersions,
      and(
        eq(translationVersions.entryId, translations.entryId),
        eq(translationVersions.locale, translations.locale),
        eq(translationVersions.version, translations.publishedVersion),
      ),
    )
    .where(and(eq(entries.namespaceId, namespaceId), sql`${translations.publishedVersion} IS NOT NULL`))
    .all();
}

function main(): void {
  const db = getDb();
  const allNamespaces = db.select().from(namespaces).all();
  const now = nowMs();

  let created = 0;
  let skipped = 0;
  let empty = 0;

  db.transaction((tx) => {
    for (const ns of allNamespaces) {
      const rows = getPublishedRows(tx as unknown as ReturnType<typeof getDb>, ns.id);
      if (rows.length === 0) {
        empty++;
        continue;
      }

      const bundleVersion = ns.bundleVersion > 0 ? ns.bundleVersion : 1;
      const existing = tx
        .select()
        .from(releases)
        .where(and(eq(releases.namespaceId, ns.id), eq(releases.bundleVersion, bundleVersion)))
        .get();
      if (existing) {
        skipped++;
        continue;
      }

      if (ns.bundleVersion === 0) {
        tx.update(namespaces).set({ bundleVersion, updatedAt: now }).where(eq(namespaces.id, ns.id)).run();
      }

      const releaseId = newId();
      tx.insert(releases)
        .values({
          id: releaseId,
          namespaceId: ns.id,
          bundleVersion,
          status: 'published',
          source: 'migration',
          note: 'Backfilled current published state during release manifest rollout.',
          createdBy: ns.createdBy,
          createdAt: now,
          publishedAt: now,
        })
        .run();

      for (const row of rows) {
        tx.insert(releaseItems)
          .values({
            id: newId(),
            releaseId,
            entryId: row.entryId,
            locale: row.locale,
            key: row.key,
            value: row.value,
            translationVersionId: row.translationVersionId,
            translationVersionNumber: row.translationVersionNumber,
          })
          .run();
      }

      created++;
      console.log(`[release:backfill] ${ns.slug}: bundle v${bundleVersion}, ${rows.length} manifest items`);
    }
  });

  console.log(`[release:backfill] created=${created}, skipped=${skipped}, empty=${empty}`);
}

main();
