import { eq, and, sql } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { entries, translations, namespaces } from '~/db/schema';
import { getNamespaceLocales } from '~/lib/services/namespace.server';
import { writeTranslationInTx } from '~/lib/services/entry.server';
import { validateLocaleSubset } from '~/lib/validators';

export type SyncStrategy = 'skip' | 'overwrite' | 'fill_missing';

export interface SyncInput {
  sourceSlug: string;
  targetSlug: string;
  prefix?: string;
  entryIds?: string[];
  locales: string[];
  strategy: SyncStrategy;
  atVersion?: number;
  autoPublish?: boolean;
  dryRun?: boolean;
  actorId: string;
}

export interface SyncPlan {
  toCreate: number;
  toUpdate: number;
  toSkip: number;
  samples: Array<{ key: string; locale: string; action: 'create' | 'update' | 'skip'; from?: string; to?: string }>;
}

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  bundleVersion?: number;
}

export function syncSpaces(input: SyncInput): SyncPlan | (SyncResult & { plan: SyncPlan }) {
  const db = getDb();
  const source = db.select().from(namespaces).where(eq(namespaces.slug, input.sourceSlug)).get();
  const target = db.select().from(namespaces).where(eq(namespaces.slug, input.targetSlug)).get();
  if (!source) throw new Response('source not found', { status: 404 });
  if (!target) throw new Response('target not found', { status: 404 });

  const targetLocales = getNamespaceLocales(target);
  const subset = validateLocaleSubset(input.locales, targetLocales);
  if (!subset.ok) {
    throw new Response(JSON.stringify({ code: 'invalid_locales', invalid: subset.invalid }), { status: 422 });
  }

  // 拉源 entries
  let sourceEntries = db.select().from(entries).where(eq(entries.namespaceId, source.id)).all();
  if (input.prefix) sourceEntries = sourceEntries.filter((e) => e.key.startsWith(input.prefix!));
  if (input.entryIds && input.entryIds.length > 0) {
    const inSource = new Set(sourceEntries.map((e) => e.id));
    const invalid = input.entryIds.filter((id) => !inSource.has(id));
    if (invalid.length > 0) {
      throw new Response(JSON.stringify({ code: 'invalid_entry_ids', invalid }), { status: 422 });
    }
    const allow = new Set(input.entryIds);
    sourceEntries = sourceEntries.filter((e) => allow.has(e.id));
  }

  // 拉源 published 翻译
  type SrcTrans = { entryId: string; locale: string; value: string };
  const srcEntryIds = sourceEntries.map((e) => e.id);
  const idList = srcEntryIds.map((id) => `'${id}'`).join(',') || "''";
  const localeList = input.locales.map((l) => `'${l}'`).join(',');
  let srcTrans: SrcTrans[];
  if (typeof input.atVersion === 'number') {
    srcTrans = db.all(
      sql.raw(`
        WITH ranked AS (
          SELECT entry_id, locale, value, version,
                 ROW_NUMBER() OVER (PARTITION BY entry_id, locale ORDER BY version DESC) AS rn
          FROM translation_versions
          WHERE entry_id IN (${idList}) AND locale IN (${localeList})
            AND version <= ${input.atVersion} AND status='published'
        )
        SELECT entry_id AS entryId, locale, value FROM ranked WHERE rn = 1
      `),
    ) as SrcTrans[];
  } else {
    srcTrans = db
      .select({ entryId: translations.entryId, locale: translations.locale, value: translations.value })
      .from(translations)
      .where(
        and(
          sql`${translations.entryId} IN (${sql.raw(idList)})`,
          sql`${translations.locale} IN (${sql.raw(localeList)})`,
          sql`${translations.publishedVersion} IS NOT NULL`,
        ),
      )
      .all();
  }

  // 计划
  const plan: SyncPlan = { toCreate: 0, toUpdate: 0, toSkip: 0, samples: [] };
  type Action = {
    sourceEntry: { key: string; id: string };
    locale: string;
    value: string;
    type: 'create' | 'update' | 'skip';
    targetEntryId?: string;
    existingValue?: string;
  };
  const actions: Action[] = [];

  for (const srcEntry of sourceEntries) {
    const targetEntry = db
      .select()
      .from(entries)
      .where(and(eq(entries.namespaceId, target.id), eq(entries.key, srcEntry.key)))
      .get();
    const localeMap = new Map<string, string>();
    for (const t of srcTrans.filter((s) => s.entryId === srcEntry.id)) localeMap.set(t.locale, t.value);

    if (input.strategy === 'skip' && targetEntry) {
      plan.toSkip++;
      if (plan.samples.length < 10) plan.samples.push({ key: srcEntry.key, locale: '*', action: 'skip' });
      continue;
    }

    for (const l of input.locales) {
      const srcVal = localeMap.get(l);
      if (srcVal === undefined) continue;
      let targetExistingVal: string | null = null;
      if (targetEntry) {
        const existing = db
          .select()
          .from(translations)
          .where(
            and(
              eq(translations.entryId, targetEntry.id),
              eq(translations.locale, l),
              sql`${translations.publishedVersion} IS NOT NULL`,
            ),
          )
          .get();
        targetExistingVal = existing?.value ?? null;
      }
      let actionType: 'create' | 'update' | 'skip' = 'create';
      if (input.strategy === 'fill_missing' && targetExistingVal !== null) {
        actionType = 'skip';
      } else if (targetExistingVal !== null) {
        actionType = 'update';
      }

      if (actionType === 'create') plan.toCreate++;
      else if (actionType === 'update') plan.toUpdate++;
      else plan.toSkip++;

      if (plan.samples.length < 10) {
        plan.samples.push({
          key: srcEntry.key,
          locale: l,
          action: actionType,
          from: targetExistingVal ?? undefined,
          to: srcVal,
        });
      }
      actions.push({
        sourceEntry: srcEntry,
        locale: l,
        value: srcVal,
        type: actionType,
        targetEntryId: targetEntry?.id,
        existingValue: targetExistingVal ?? undefined,
      });
    }
  }

  if (input.dryRun) {
    return plan;
  }

  // 真同步
  const result: SyncResult = { created: 0, updated: 0, skipped: 0 };
  let lastBundle = 0;

  db.transaction((tx) => {
    const ctx = { bundleVersionBumped: false };
    // 先创建缺失的 target entries
    const ensureTargetEntry = (key: string, _sourceEntryId: string): string => {
      const existing = tx
        .select()
        .from(entries)
        .where(and(eq(entries.namespaceId, target.id), eq(entries.key, key)))
        .get();
      if (existing) return existing.id;
      const id = newId();
      const now = nowMs();
      tx.insert(entries)
        .values({
          id,
          namespaceId: target.id,
          key,
          createdAt: now,
          updatedAt: now,
          updatedBy: input.actorId,
        })
        .run();
      return id;
    };

    for (const action of actions) {
      if (action.type === 'skip') {
        result.skipped++;
        continue;
      }
      const targetEntryId = action.targetEntryId ?? ensureTargetEntry(action.sourceEntry.key, action.sourceEntry.id);
      writeTranslationInTx(
        tx as unknown as ReturnType<typeof getDb>,
        {
          entryId: targetEntryId,
          locale: action.locale,
          value: action.value,
          source: 'sync',
          status: input.autoPublish ? 'published' : 'draft',
          actorId: input.actorId,
          metadata: { source_namespace_id: source.id },
        },
        ctx,
      );
      if (action.type === 'create') result.created++;
      else result.updated++;
    }
    if (ctx.bundleVersionBumped) {
      const ns = tx.select().from(namespaces).where(eq(namespaces.id, target.id)).get();
      lastBundle = ns?.bundleVersion ?? 0;
    }
  });

  return { ...result, plan, ...(lastBundle ? { bundleVersion: lastBundle } : {}) };
}
