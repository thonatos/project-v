import { and, desc, eq, sql } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { entries, releaseItems, releases, translationVersions, translations } from '~/db/schema';
import type { Release } from '~/db/schema';

export type ReleaseSource = Release['source'];

export interface CreateReleaseInput {
  namespaceId: string;
  bundleVersion: number;
  actorId: string;
  source: ReleaseSource;
  note?: string | null;
}

export interface ReleaseManifestRow {
  key: string;
  locale: string;
  value: string;
  version: number;
  entryId: string;
  translationVersionId: string;
}

export interface ReleaseBundleRows {
  release: Release;
  rows: ReleaseManifestRow[];
}

export function listReleases(namespaceId: string, limit = 50): Release[] {
  const db = getDb();
  return db
    .select()
    .from(releases)
    .where(eq(releases.namespaceId, namespaceId))
    .orderBy(desc(releases.bundleVersion))
    .limit(Math.min(limit, 200))
    .all();
}

export function getRelease(namespaceId: string, bundleVersion: number): Release | null {
  const db = getDb();
  return (
    db
      .select()
      .from(releases)
      .where(and(eq(releases.namespaceId, namespaceId), eq(releases.bundleVersion, bundleVersion)))
      .get() ?? null
  );
}

/**
 * Capture the namespace's current published translations into an immutable
 * release manifest. Call this inside the same transaction that updated the
 * `translations` published cache and bumped `namespaces.bundle_version`.
 */
export function createReleaseFromCurrent(
  tx: ReturnType<typeof getDb>,
  input: CreateReleaseInput,
): { release: Release; itemCount: number } {
  const existing = tx
    .select()
    .from(releases)
    .where(and(eq(releases.namespaceId, input.namespaceId), eq(releases.bundleVersion, input.bundleVersion)))
    .get();
  if (existing) {
    throw new Error(`release already exists: namespace=${input.namespaceId} bundle=${input.bundleVersion}`);
  }

  const now = nowMs();
  const release: Release = {
    id: newId(),
    namespaceId: input.namespaceId,
    bundleVersion: input.bundleVersion,
    status: 'published',
    source: input.source,
    note: input.note ?? null,
    createdBy: input.actorId,
    createdAt: now,
    publishedAt: now,
  };
  tx.insert(releases).values(release).run();

  const currentRows = tx
    .select({
      entryId: entries.id,
      key: entries.key,
      locale: translations.locale,
      value: translationVersions.value,
      translationVersionId: translationVersions.id,
      translationVersionNumber: translationVersions.version,
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
    .where(and(eq(entries.namespaceId, input.namespaceId), sql`${translations.publishedVersion} IS NOT NULL`))
    .all();

  for (const row of currentRows) {
    tx.insert(releaseItems)
      .values({
        id: newId(),
        releaseId: release.id,
        entryId: row.entryId,
        locale: row.locale,
        key: row.key,
        value: row.value,
        translationVersionId: row.translationVersionId,
        translationVersionNumber: row.translationVersionNumber,
      })
      .run();
  }

  return { release, itemCount: currentRows.length };
}

export function readReleaseRows(input: {
  namespaceId: string;
  bundleVersion: number;
  locales?: string[];
}): ReleaseBundleRows | null {
  const db = getDb();
  const release = getRelease(input.namespaceId, input.bundleVersion);
  if (!release) return null;

  const localeList =
    input.locales && input.locales.length > 0 ? input.locales.map((l) => `'${l.replace(/'/g, "''")}'`).join(',') : null;

  const rows = db
    .select({
      key: releaseItems.key,
      locale: releaseItems.locale,
      value: releaseItems.value,
      version: releaseItems.translationVersionNumber,
      entryId: releaseItems.entryId,
      translationVersionId: releaseItems.translationVersionId,
    })
    .from(releaseItems)
    .where(
      and(
        eq(releaseItems.releaseId, release.id),
        localeList ? sql`${releaseItems.locale} IN (${sql.raw(localeList)})` : undefined,
      ),
    )
    .all();

  return { release, rows };
}

export function rowsToLocaleBundle(
  rows: ReleaseManifestRow[],
  locales: string[],
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const locale of locales) out[locale] = {};
  for (const row of rows) {
    if (!out[row.locale]) out[row.locale] = {};
    out[row.locale]![row.key] = row.value;
  }
  return out;
}
