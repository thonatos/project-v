import { eq, and, sql, max, like } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { entries, translations, translationVersions, namespaces } from '~/db/schema';
import type { Entry, TranslationSource, TranslationStatus } from '~/db/schema';
import { flatKeySchema, localeSchema, validateLocaleSubset, parseEntries } from '~/lib/validators';
import { getNamespaceLocales, bumpBundleVersion } from '~/lib/services/namespace.server';
import { createReleaseFromCurrent, type ReleaseSource } from '~/lib/services/release.server';
import { writeAuditEvent } from '~/lib/services/audit.server';

const IMPORT_MAX = 10000;

export function getEntryByKey(namespaceId: string, key: string): Entry | null {
  const db = getDb();
  return (
    db
      .select()
      .from(entries)
      .where(and(eq(entries.namespaceId, namespaceId), eq(entries.key, key)))
      .get() ?? null
  );
}

export function deleteEntry(namespaceId: string, key: string): boolean {
  const db = getDb();
  return db.transaction((tx) => {
    const entry = tx
      .select()
      .from(entries)
      .where(and(eq(entries.namespaceId, namespaceId), eq(entries.key, key)))
      .get();
    if (!entry) return false;
    // 检查是否含 published 翻译
    const hasPublished = tx
      .select()
      .from(translations)
      .where(and(eq(translations.entryId, entry.id), sql`${translations.publishedVersion} IS NOT NULL`))
      .get();
    tx.delete(entries).where(eq(entries.id, entry.id)).run();
    let metadata: Record<string, unknown> = { key, hadPublished: !!hasPublished };
    if (hasPublished) {
      const bundleVersion = bumpBundleVersion(tx as unknown as ReturnType<typeof getDb>, namespaceId);
      const release = createReleaseFromCurrent(tx as unknown as ReturnType<typeof getDb>, {
        namespaceId,
        bundleVersion,
        actorId: entry.updatedBy,
        source: 'delete',
        note: `Deleted entry ${key}`,
      });
      metadata = { ...metadata, releaseId: release.release.id, bundleVersion, itemCount: release.itemCount };
    }
    writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
      namespaceId,
      actorId: entry.updatedBy,
      action: 'entry.delete',
      resourceType: 'entry',
      resourceId: entry.id,
      before: entry,
      metadata,
    });
    return true;
  });
}

export interface WriteTranslationInput {
  entryId: string;
  locale: string;
  value: string;
  source: TranslationSource;
  status: TranslationStatus; // 'draft' | 'published'  ('discarded' 由 publish/discard 单独管理)
  actorId: string;
  metadata?: Record<string, unknown>;
}

interface WriteTranslationContext {
  /** 在外层事务内是否已经为本次操作 +1 过 bundle_version */
  bundleVersionBumped: boolean;
  bundleVersion?: number;
  namespaceId?: string;
}

/**
 * 统一写入入口:
 * - 在 translation_versions 插入新行(version = max+1)
 * - 若 status=published: 更新 translations 指针,并按需 bump bundle_version
 * - 必须在事务外调用(内部自启事务,或通过 dbOrTx 共享上层事务)
 */
export function writeTranslation(input: WriteTranslationInput): { version: number; status: TranslationStatus } {
  const db = getDb();
  return db.transaction((tx) => {
    const ctx: WriteTranslationContext = { bundleVersionBumped: false };
    const result = writeTranslationInTx(tx as unknown as ReturnType<typeof getDb>, input, ctx);
    maybeCreateRelease(tx as unknown as ReturnType<typeof getDb>, ctx, input.actorId, releaseSourceFor(input.source));
    return result;
  });
}

function releaseSourceFor(source: TranslationSource): ReleaseSource {
  if (source === 'import') return 'import';
  if (source === 'sync') return 'sync';
  if (source === 'revert') return 'revert';
  return 'publish';
}

function maybeCreateRelease(
  tx: ReturnType<typeof getDb>,
  ctx: WriteTranslationContext,
  actorId: string,
  source: ReleaseSource,
): void {
  if (!ctx.bundleVersionBumped || !ctx.namespaceId || !ctx.bundleVersion) return;
  createReleaseFromCurrent(tx, {
    namespaceId: ctx.namespaceId,
    bundleVersion: ctx.bundleVersion,
    actorId,
    source,
  });
}

export function writeTranslationInTx(
  tx: ReturnType<typeof getDb>,
  input: WriteTranslationInput,
  ctx: WriteTranslationContext,
): { version: number; status: TranslationStatus } {
  const entry = tx.select().from(entries).where(eq(entries.id, input.entryId)).get();
  if (!entry) throw new Error('entry not found');

  // 计算新 version
  const maxRow = tx
    .select({ m: max(translationVersions.version) })
    .from(translationVersions)
    .where(and(eq(translationVersions.entryId, input.entryId), eq(translationVersions.locale, input.locale)))
    .get();
  const newVersion = (maxRow?.m ?? 0) + 1;
  const now = nowMs();

  tx.insert(translationVersions)
    .values({
      id: newId(),
      entryId: input.entryId,
      locale: input.locale,
      version: newVersion,
      value: input.value,
      source: input.source,
      status: input.status,
      actorId: input.actorId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: now,
      publishedAt: input.status === 'published' ? now : null,
    })
    .run();

  if (input.status === 'published') {
    // upsert translations 指针
    const existing = tx
      .select()
      .from(translations)
      .where(and(eq(translations.entryId, input.entryId), eq(translations.locale, input.locale)))
      .get();
    if (existing) {
      tx.update(translations)
        .set({
          value: input.value,
          publishedVersion: newVersion,
          updatedAt: now,
          updatedBy: input.actorId,
        })
        .where(eq(translations.id, existing.id))
        .run();
    } else {
      tx.insert(translations)
        .values({
          id: newId(),
          entryId: input.entryId,
          locale: input.locale,
          value: input.value,
          publishedVersion: newVersion,
          updatedAt: now,
          updatedBy: input.actorId,
        })
        .run();
    }

    if (!ctx.bundleVersionBumped) {
      ctx.bundleVersion = bumpBundleVersion(tx, entry.namespaceId);
      ctx.namespaceId = entry.namespaceId;
      ctx.bundleVersionBumped = true;
    }
  }

  // 同步更新 entries.updated_at
  tx.update(entries).set({ updatedAt: now, updatedBy: input.actorId }).where(eq(entries.id, input.entryId)).run();

  return { version: newVersion, status: input.status };
}

export interface UpsertEntryInput {
  namespaceId: string;
  key: string;
  description?: string | null;
  translations: Record<string, string>; // locale -> value
  asDraft?: boolean;
  actorId: string;
}

export function upsertEntry(input: UpsertEntryInput): { entry: Entry; versions: Record<string, number> } {
  flatKeySchema.parse(input.key);
  const db = getDb();
  const ns = db.select().from(namespaces).where(eq(namespaces.id, input.namespaceId)).get();
  if (!ns) throw new Error('namespace not found');
  const allowedLocales = getNamespaceLocales(ns);
  const localesUsed = Object.keys(input.translations);
  for (const l of localesUsed) localeSchema.parse(l);
  const subset = validateLocaleSubset(localesUsed, allowedLocales);
  if (!subset.ok) {
    throw new Error(`未启用的 locale: ${subset.invalid.join(', ')}`);
  }

  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(entries)
      .where(and(eq(entries.namespaceId, input.namespaceId), eq(entries.key, input.key)))
      .get();
    const now = nowMs();
    let entry: Entry;
    if (existing) {
      tx.update(entries)
        .set({
          description: input.description ?? existing.description,
          updatedAt: now,
          updatedBy: input.actorId,
        })
        .where(eq(entries.id, existing.id))
        .run();
      entry = { ...existing, description: input.description ?? existing.description, updatedAt: now };
    } else {
      const id = newId();
      tx.insert(entries)
        .values({
          id,
          namespaceId: input.namespaceId,
          key: input.key,
          description: input.description ?? null,
          createdAt: now,
          updatedAt: now,
          updatedBy: input.actorId,
        })
        .run();
      entry = {
        id,
        namespaceId: input.namespaceId,
        key: input.key,
        description: input.description ?? null,
        createdAt: now,
        updatedAt: now,
        updatedBy: input.actorId,
      };
    }

    const ctx: WriteTranslationContext = { bundleVersionBumped: false };
    const versions: Record<string, number> = {};
    for (const [locale, value] of Object.entries(input.translations)) {
      const r = writeTranslationInTx(
        tx as unknown as ReturnType<typeof getDb>,
        {
          entryId: entry.id,
          locale,
          value,
          source: 'manual',
          status: input.asDraft ? 'draft' : 'published',
          actorId: input.actorId,
        },
        ctx,
      );
      versions[locale] = r.version;
    }
    maybeCreateRelease(tx as unknown as ReturnType<typeof getDb>, ctx, input.actorId, 'publish');
    writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
      namespaceId: input.namespaceId,
      actorId: input.actorId,
      action: existing ? 'entry.update' : 'entry.create',
      resourceType: 'entry',
      resourceId: entry.id,
      metadata: {
        key: entry.key,
        locales: Object.keys(input.translations),
        asDraft: input.asDraft === true,
        versions,
        bundleVersion: ctx.bundleVersion,
      },
    });
    return { entry, versions };
  });
}

export interface ImportFlatInput {
  namespaceId: string;
  locale: string;
  entries: Record<string, string>;
  asDraft?: boolean;
  actorId: string;
}

export interface ImportFlatResult {
  ok: boolean;
  imported: number;
  total: number;
  errors: Array<{ key: string; reason: string }>;
}

export function importFlat(input: ImportFlatInput): ImportFlatResult {
  const db = getDb();
  const ns = db.select().from(namespaces).where(eq(namespaces.id, input.namespaceId)).get();
  if (!ns) throw new Error('namespace not found');
  const allowed = getNamespaceLocales(ns);
  if (!allowed.includes(input.locale)) {
    return { ok: false, imported: 0, total: 0, errors: [{ key: '', reason: 'locale 未启用' }] };
  }
  const total = Object.keys(input.entries).length;
  if (total > IMPORT_MAX) {
    return { ok: false, imported: 0, total, errors: [{ key: '', reason: `超过单批 ${IMPORT_MAX} 条上限` }] };
  }
  const parsed = parseEntries(input.entries);
  if (!parsed.ok) {
    return { ok: false, imported: 0, total, errors: parsed.errors };
  }

  return db.transaction((tx) => {
    const ctx: WriteTranslationContext = { bundleVersionBumped: false };
    let imported = 0;
    for (const { key, value } of parsed.entries) {
      const existing = tx
        .select()
        .from(entries)
        .where(and(eq(entries.namespaceId, input.namespaceId), eq(entries.key, key)))
        .get();
      const now = nowMs();
      let entryId: string;
      if (existing) {
        entryId = existing.id;
        tx.update(entries).set({ updatedAt: now, updatedBy: input.actorId }).where(eq(entries.id, entryId)).run();
      } else {
        entryId = newId();
        tx.insert(entries)
          .values({
            id: entryId,
            namespaceId: input.namespaceId,
            key,
            createdAt: now,
            updatedAt: now,
            updatedBy: input.actorId,
          })
          .run();
      }
      writeTranslationInTx(
        tx as unknown as ReturnType<typeof getDb>,
        {
          entryId,
          locale: input.locale,
          value,
          source: 'import',
          status: input.asDraft ? 'draft' : 'published',
          actorId: input.actorId,
        },
        ctx,
      );
      imported++;
    }
    maybeCreateRelease(tx as unknown as ReturnType<typeof getDb>, ctx, input.actorId, 'import');
    writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
      namespaceId: input.namespaceId,
      actorId: input.actorId,
      action: 'entry.import',
      resourceType: 'namespace',
      resourceId: input.namespaceId,
      metadata: {
        locale: input.locale,
        imported,
        total,
        asDraft: input.asDraft === true,
        bundleVersion: ctx.bundleVersion,
      },
    });
    return { ok: true, imported, total, errors: [] };
  });
}

export function findEntriesByPrefix(namespaceId: string, prefix?: string): Entry[] {
  const db = getDb();
  if (!prefix) {
    return db.select().from(entries).where(eq(entries.namespaceId, namespaceId)).all();
  }
  return db
    .select()
    .from(entries)
    .where(and(eq(entries.namespaceId, namespaceId), like(entries.key, `${prefix}%`)))
    .all();
}
