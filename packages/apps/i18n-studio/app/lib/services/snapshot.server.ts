import { eq, and, sql } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { entries, translations, namespaces } from '~/db/schema';
import { getNamespaceLocales } from '~/lib/services/namespace.server';
import { getLocale } from '~/lib/services/locale.server';
import { readReleaseRows } from '~/lib/services/release.server';
import { validateLocaleSubset } from '~/lib/validators';
import { extractBearer, verifyToken } from '~/lib/api-token.server';

export interface SnapshotInput {
  slug: string;
  locales?: string[];
  bundleVersion?: number;
}

export interface SnapshotBundle {
  namespace: string;
  bundleVersion: number;
  locales: Record<string, Record<string, string>>;
}

export interface SnapshotMeta {
  etag: string;
  isPublic: boolean;
  bundleVersion: number;
  effectiveLocales: string[];
}

export function computeEtag(bundleVersion: number, locales: string[], atVersion?: number): string {
  const sorted = [...locales].sort().join(',');
  return `"${bundleVersion}-${sorted}-${atVersion ?? 'latest'}"`;
}

export function getBundle(input: SnapshotInput): { bundle: SnapshotBundle; meta: SnapshotMeta } {
  const db = getDb();
  const ns = db.select().from(namespaces).where(eq(namespaces.slug, input.slug)).get();
  if (!ns) throw new Response('Not Found', { status: 404 });
  const allowed = getNamespaceLocales(ns);
  const target = input.locales && input.locales.length > 0 ? input.locales : allowed;
  const subset = validateLocaleSubset(target, allowed);
  if (!subset.ok) {
    throw new Response(JSON.stringify({ code: 'invalid_locales', invalid: subset.invalid }), { status: 422 });
  }

  const localeList = target.map((l) => `'${l}'`).join(',');

  type Row = { key: string; locale: string; value: string };
  let rows: Row[];
  let effectiveBundleVersion = ns.bundleVersion;
  if (typeof input.bundleVersion === 'number') {
    const releaseRows = readReleaseRows({
      namespaceId: ns.id,
      bundleVersion: input.bundleVersion,
      locales: target,
    });
    if (!releaseRows) {
      throw new Response(JSON.stringify({ code: 'release_not_found', bundleVersion: input.bundleVersion }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    effectiveBundleVersion = releaseRows.release.bundleVersion;
    rows = releaseRows.rows.map((r) => ({ key: r.key, locale: r.locale, value: r.value }));
  } else {
    rows = db
      .select({ key: entries.key, locale: translations.locale, value: translations.value })
      .from(translations)
      .innerJoin(entries, eq(entries.id, translations.entryId))
      .where(
        and(
          eq(entries.namespaceId, ns.id),
          sql`${translations.locale} IN (${sql.raw(localeList)})`,
          sql`${translations.publishedVersion} IS NOT NULL`,
        ),
      )
      .all();
  }

  const bundle: SnapshotBundle = {
    namespace: ns.slug,
    bundleVersion: effectiveBundleVersion,
    locales: {},
  };
  for (const l of target) bundle.locales[l] = {};
  for (const r of rows) {
    bundle.locales[r.locale]![r.key] = r.value;
  }

  return {
    bundle,
    meta: {
      etag: computeEtag(bundle.bundleVersion, target, input.bundleVersion),
      isPublic: ns.publicRead,
      bundleVersion: bundle.bundleVersion,
      effectiveLocales: target,
    },
  };
}

export interface LocaleManifestEntry {
  code: string;
  label: string;
  englishLabel: string;
  nativeLabel: string | null;
}

export interface LocaleManifest {
  namespace: string;
  locales: LocaleManifestEntry[];
}

/**
 * 语种清单:返回该 namespace 受支持的语种(effectiveLocales)及其字典元信息。
 * 字典里缺失的 code 仍会列出,label/englishLabel 降级为 code 自身、nativeLabel 为 null,
 * 使消费方(pull / codegen)始终能拿到完整语种集。
 */
export function getLocaleManifest(slug: string): LocaleManifest {
  const db = getDb();
  const ns = db.select().from(namespaces).where(eq(namespaces.slug, slug)).get();
  if (!ns) throw new Response('Not Found', { status: 404 });
  const codes = getNamespaceLocales(ns);
  const locales: LocaleManifestEntry[] = codes.map((code) => {
    const row = getLocale(code);
    return {
      code,
      label: row?.label ?? code,
      englishLabel: row?.englishLabel ?? code,
      nativeLabel: row?.nativeLabel ?? null,
    };
  });
  return { namespace: ns.slug, locales };
}

export function requireSnapshotAccess(request: Request, slug: string): { isPublic: boolean } {
  const db = getDb();
  const ns = db.select().from(namespaces).where(eq(namespaces.slug, slug)).get();
  if (!ns) throw new Response('Not Found', { status: 404 });
  if (ns.publicRead) return { isPublic: true };
  const plaintext = extractBearer(request);
  if (!plaintext) throw new Response('Unauthorized', { status: 401 });
  const v = verifyToken(plaintext, 'readonly');
  if (!v || v.namespaceSlug !== slug) {
    throw new Response('Unauthorized', { status: 401 });
  }
  return { isPublic: false };
}
