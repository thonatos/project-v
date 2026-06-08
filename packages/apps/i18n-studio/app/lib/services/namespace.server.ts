import { eq, and, count, sql } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { namespaces, memberships, entries, translations, translationVersions } from '~/db/schema';
import type { Namespace } from '~/db/schema';
import { localeSchema, slugSchema } from '~/lib/validators';
import { jsonError } from '~/lib/api.server';
import { assertLocalesExist, listEnabledLocales } from '~/lib/services/locale.server';

const DEFAULT_LOCALE_COUNT = 3;

export function listNamespaces(userId: string): Array<Namespace & { role: string }> {
  const db = getDb();
  const rows = db
    .select({
      ns: namespaces,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(namespaces, eq(memberships.namespaceId, namespaces.id))
    .where(eq(memberships.userId, userId))
    .all();
  return rows.map((r) => ({ ...r.ns, role: r.role }));
}

export function getNamespaceBySlug(slug: string): Namespace | null {
  const db = getDb();
  return db.select().from(namespaces).where(eq(namespaces.slug, slug)).get() ?? null;
}

export interface CreateNamespaceInput {
  slug: string;
  name: string;
  defaultLocale?: string;
  locales?: string[];
  createdBy: string;
}

export function createNamespace(input: CreateNamespaceInput): Namespace {
  slugSchema.parse(input.slug);
  const db = getDb();
  const existing = db.select().from(namespaces).where(eq(namespaces.slug, input.slug)).get();
  if (existing) {
    throw new Error('slug 已存在');
  }
  let locales: string[];
  if (input.locales && input.locales.length > 0) {
    for (const l of input.locales) localeSchema.parse(l);
    locales = input.locales;
  } else {
    locales = listEnabledLocales()
      .slice(0, DEFAULT_LOCALE_COUNT)
      .map((l) => l.code);
    if (locales.length === 0) {
      throw jsonError(422, 'locale_dictionary_empty', '系统语言字典为空,请先在 /dashboard/locales 中添加 locale');
    }
  }
  assertLocalesExist(locales);
  const defaultLocale = input.defaultLocale ?? locales[0];
  if (!locales.includes(defaultLocale)) {
    throw new Error('default_locale 必须在 locales 列表中');
  }

  const id = newId();
  const now = nowMs();
  return db.transaction((tx) => {
    tx.insert(namespaces)
      .values({
        id,
        slug: input.slug,
        name: input.name,
        defaultLocale,
        locales: JSON.stringify(locales),
        publicRead: false,
        bundleVersion: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: input.createdBy,
      })
      .run();
    tx.insert(memberships)
      .values({
        id: newId(),
        namespaceId: id,
        userId: input.createdBy,
        role: 'admin',
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return tx.select().from(namespaces).where(eq(namespaces.id, id)).get()!;
  });
}

export interface UpdateNamespaceInput {
  name?: string;
  defaultLocale?: string;
  locales?: string[];
  publicRead?: boolean;
}

export function updateNamespace(slug: string, patch: UpdateNamespaceInput): Namespace {
  const db = getDb();
  const ns = getNamespaceBySlug(slug);
  if (!ns) throw new Error('namespace not found');

  return db.transaction((tx) => {
    const next = { ...ns };
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.publicRead !== undefined) next.publicRead = patch.publicRead;

    let nextLocales: string[] = JSON.parse(ns.locales) as string[];
    if (patch.locales) {
      for (const l of patch.locales) localeSchema.parse(l);
      nextLocales = Array.from(new Set(patch.locales));
      assertLocalesExist(nextLocales);
    }

    let nextDefault = ns.defaultLocale;
    if (patch.defaultLocale !== undefined) {
      localeSchema.parse(patch.defaultLocale);
      nextDefault = patch.defaultLocale;
    }
    if (!nextLocales.includes(nextDefault)) {
      throw new Error('default_locale 必须在 locales 列表中');
    }

    // 校验:被移除的 locale 不能有 published 翻译
    const oldLocales: string[] = JSON.parse(ns.locales) as string[];
    const removed = oldLocales.filter((l) => !nextLocales.includes(l));
    if (removed.length > 0) {
      const refs = tx
        .select({ entryId: translations.entryId, locale: translations.locale, key: entries.key })
        .from(translations)
        .innerJoin(entries, eq(translations.entryId, entries.id))
        .where(and(eq(entries.namespaceId, ns.id), sql`${translations.publishedVersion} IS NOT NULL`))
        .all()
        .filter((r) => removed.includes(r.locale));
      if (refs.length > 0) {
        const samples = refs.slice(0, 5).map((r) => `${r.key} (${r.locale})`);
        throw new Error(`无法移除被引用的 locale: ${samples.join(', ')}`);
      }
    }

    tx.update(namespaces)
      .set({
        name: next.name,
        defaultLocale: nextDefault,
        locales: JSON.stringify(nextLocales),
        publicRead: next.publicRead,
        updatedAt: nowMs(),
      })
      .where(eq(namespaces.id, ns.id))
      .run();

    return tx.select().from(namespaces).where(eq(namespaces.id, ns.id)).get()!;
  });
}

export function deleteNamespace(slug: string): void {
  const db = getDb();
  const ns = getNamespaceBySlug(slug);
  if (!ns) return;
  db.delete(namespaces).where(eq(namespaces.id, ns.id)).run();
}

export function getNamespaceLocales(ns: Namespace): string[] {
  return JSON.parse(ns.locales) as string[];
}

export interface NamespaceStats {
  entriesCount: number;
  membersCount: number;
  draftCount: number;
}

export function getNamespaceStats(namespaceId: string): NamespaceStats {
  const db = getDb();
  const entriesCount =
    db.select({ c: count() }).from(entries).where(eq(entries.namespaceId, namespaceId)).get()?.c ?? 0;
  const membersCount =
    db.select({ c: count() }).from(memberships).where(eq(memberships.namespaceId, namespaceId)).get()?.c ?? 0;
  const draftRows = db
    .select({ c: count() })
    .from(translationVersions)
    .innerJoin(entries, eq(translationVersions.entryId, entries.id))
    .where(and(eq(entries.namespaceId, namespaceId), eq(translationVersions.status, 'draft')))
    .get();
  return {
    entriesCount,
    membersCount,
    draftCount: draftRows?.c ?? 0,
  };
}

/**
 * 原子递增 bundle_version,事务内调用
 */
export function bumpBundleVersion(tx: ReturnType<typeof getDb>, namespaceId: string): number {
  tx.run(
    sql`UPDATE namespaces SET bundle_version = bundle_version + 1, updated_at = ${nowMs()} WHERE id = ${namespaceId}`,
  );
  const ns = tx.select().from(namespaces).where(eq(namespaces.id, namespaceId)).get();
  return ns?.bundleVersion ?? 0;
}
