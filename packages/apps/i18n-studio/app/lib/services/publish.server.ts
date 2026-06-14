import { eq, and } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { translationVersions, translations, entries } from '~/db/schema';
import { bumpBundleVersion } from '~/lib/services/namespace.server';
import { createReleaseFromCurrent } from '~/lib/services/release.server';
import { writeAuditEvent } from '~/lib/services/audit.server';

export interface PublishItem {
  entryId: string;
  locale: string;
  version: number;
}

/**
 * 把指定 (entryId, locale, version) 的 draft 行 publish。
 * 不分配新版本号,只把 status: draft → published,并把 translations 指针指向该 version。
 */
export function publishBatch(items: PublishItem[], actorId: string): { published: number; bundleVersion: number } {
  if (items.length === 0) return { published: 0, bundleVersion: 0 };
  const db = getDb();
  return db.transaction((tx) => {
    let published = 0;
    const namespaceIds = new Set<string>();
    for (const item of items) {
      const row = tx
        .select()
        .from(translationVersions)
        .where(
          and(
            eq(translationVersions.entryId, item.entryId),
            eq(translationVersions.locale, item.locale),
            eq(translationVersions.version, item.version),
          ),
        )
        .get();
      if (!row) {
        throw new Response(`version not found: ${item.entryId} ${item.locale} v${item.version}`, { status: 404 });
      }
      if (row.status !== 'draft') {
        throw new Response(`version is not draft: status=${row.status}`, { status: 400 });
      }
      const now = nowMs();
      tx.update(translationVersions)
        .set({ status: 'published', publishedAt: now })
        .where(eq(translationVersions.id, row.id))
        .run();

      const entry = tx.select().from(entries).where(eq(entries.id, item.entryId)).get();
      if (!entry) throw new Response('entry not found', { status: 404 });
      namespaceIds.add(entry.namespaceId);

      const existing = tx
        .select()
        .from(translations)
        .where(and(eq(translations.entryId, item.entryId), eq(translations.locale, item.locale)))
        .get();
      if (existing) {
        tx.update(translations)
          .set({
            value: row.value,
            publishedVersion: row.version,
            updatedAt: now,
            updatedBy: actorId,
          })
          .where(eq(translations.id, existing.id))
          .run();
      } else {
        tx.insert(translations)
          .values({
            id: newId(),
            entryId: item.entryId,
            locale: item.locale,
            value: row.value,
            publishedVersion: row.version,
            updatedAt: now,
            updatedBy: actorId,
          })
          .run();
      }
      published++;
    }
    let lastBundle = 0;
    for (const nsId of namespaceIds) {
      lastBundle = bumpBundleVersion(tx as unknown as ReturnType<typeof getDb>, nsId);
      const release = createReleaseFromCurrent(tx as unknown as ReturnType<typeof getDb>, {
        namespaceId: nsId,
        bundleVersion: lastBundle,
        actorId,
        source: 'publish',
      });
      writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
        namespaceId: nsId,
        actorId,
        action: 'release.publish',
        resourceType: 'release',
        resourceId: release.release.id,
        metadata: { bundleVersion: lastBundle, published, itemCount: release.itemCount },
      });
    }
    return { published, bundleVersion: lastBundle };
  });
}

export function publishOne(entryId: string, locale: string, version: number, actorId: string) {
  return publishBatch([{ entryId, locale, version }], actorId);
}

export function discard(entryId: string, locale: string, version: number, _actorId: string): boolean {
  const db = getDb();
  return db.transaction((tx) => {
    const row = tx
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
    if (!row) throw new Response('version not found', { status: 404 });
    if (row.status !== 'draft')
      throw new Response(`only draft can be discarded: status=${row.status}`, { status: 400 });
    tx.update(translationVersions).set({ status: 'discarded' }).where(eq(translationVersions.id, row.id)).run();
    const entry = tx.select().from(entries).where(eq(entries.id, entryId)).get();
    writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
      namespaceId: entry?.namespaceId ?? null,
      actorId: _actorId,
      action: 'translation.discard',
      resourceType: 'translation_version',
      resourceId: row.id,
      before: row,
      metadata: { entryId, locale, version },
    });
    return true;
  });
}
