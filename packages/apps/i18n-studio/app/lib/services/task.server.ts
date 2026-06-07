import { eq, and, sql, desc } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { entries, translations, translationTasks, translationTaskItems, namespaces } from '~/db/schema';
import type { TranslationTask, TranslationTaskItem } from '~/db/schema';
import { getNamespaceLocales } from '~/lib/services/namespace.server';
import { writeTranslationInTx } from '~/lib/services/entry.server';
import { localeSchema, validateLocaleSubset } from '~/lib/validators';

export interface CreateTaskInput {
  namespaceId: string;
  filter?: { prefix?: string; missingLocale?: string };
  entryIds?: string[];
  targetLocales: string[];
  sourceLocale?: string;
  createdBy: string;
}

export function createTask(input: CreateTaskInput): TranslationTask {
  const db = getDb();
  const ns = db.select().from(namespaces).where(eq(namespaces.id, input.namespaceId)).get();
  if (!ns) throw new Error('namespace not found');
  const allowed = getNamespaceLocales(ns);
  for (const l of input.targetLocales) localeSchema.parse(l);
  const subset = validateLocaleSubset(input.targetLocales, allowed);
  if (!subset.ok) throw new Error(`未启用的 locale: ${subset.invalid.join(', ')}`);
  const sourceLocale = input.sourceLocale ?? ns.defaultLocale;
  if (!allowed.includes(sourceLocale)) throw new Error('source_locale 未启用');

  return db.transaction((tx) => {
    // 收集候选 entries
    let candidates = tx.select().from(entries).where(eq(entries.namespaceId, input.namespaceId)).all();
    if (input.filter?.prefix) {
      candidates = candidates.filter((e) => e.key.startsWith(input.filter!.prefix!));
    }
    if (input.entryIds && input.entryIds.length > 0) {
      const allowSet = new Set(input.entryIds);
      // 校验 ids ⊆ namespace
      const inNs = new Set(candidates.map((e) => e.id));
      const invalid = input.entryIds.filter((id) => !inNs.has(id));
      if (invalid.length > 0) {
        throw new Response(JSON.stringify({ code: 'invalid_entry_ids', invalid }), { status: 422 });
      }
      candidates = candidates.filter((e) => allowSet.has(e.id));
    }
    if (input.filter?.missingLocale) {
      const missingLocale = input.filter.missingLocale;
      const presentRows = tx
        .select({ entryId: translations.entryId })
        .from(translations)
        .where(
          and(
            eq(translations.locale, missingLocale),
            sql`${translations.publishedVersion} IS NOT NULL`,
            sql`${translations.entryId} IN (${sql.raw(candidates.map((c) => `'${c.id}'`).join(',') || "''")})`,
          ),
        )
        .all();
      const present = new Set(presentRows.map((r) => r.entryId));
      candidates = candidates.filter((c) => !present.has(c.id));
    }

    const now = nowMs();
    const taskId = newId();
    const task: TranslationTask = {
      id: taskId,
      namespaceId: input.namespaceId,
      status: 'pending',
      targetLocales: JSON.stringify(input.targetLocales),
      filter: JSON.stringify(input.filter ?? {}),
      sourceLocale,
      total: candidates.length,
      done: 0,
      createdBy: input.createdBy,
      workerId: null,
      startedAt: null,
      completedAt: null,
      failedReason: null,
      createdAt: now,
      updatedAt: now,
    };
    tx.insert(translationTasks).values(task).run();

    for (const cand of candidates) {
      const sourceTrans = tx
        .select()
        .from(translations)
        .where(and(eq(translations.entryId, cand.id), eq(translations.locale, sourceLocale)))
        .get();
      tx.insert(translationTaskItems)
        .values({
          id: newId(),
          taskId,
          entryId: cand.id,
          key: cand.key,
          sourceValue: sourceTrans?.value ?? '',
          status: 'pending',
        })
        .run();
    }

    return task;
  });
}

export function listTasks(namespaceId: string, status?: string): TranslationTask[] {
  const db = getDb();
  return db
    .select()
    .from(translationTasks)
    .where(
      and(
        eq(translationTasks.namespaceId, namespaceId),
        status ? eq(translationTasks.status, status as TranslationTask['status']) : undefined,
      ),
    )
    .orderBy(desc(translationTasks.createdAt))
    .all();
}

export function getTask(taskId: string): { task: TranslationTask; items: TranslationTaskItem[] } | null {
  const db = getDb();
  const task = db.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get();
  if (!task) return null;
  const items = db.select().from(translationTaskItems).where(eq(translationTaskItems.taskId, taskId)).all();
  return { task, items };
}

export function claimTask(taskId: string, workerId: string): { task: TranslationTask; items: TranslationTaskItem[] } {
  const db = getDb();
  return db.transaction((tx) => {
    const now = nowMs();
    const result = tx
      .update(translationTasks)
      .set({ status: 'in_progress', workerId, startedAt: now, updatedAt: now })
      .where(and(eq(translationTasks.id, taskId), eq(translationTasks.status, 'pending')))
      .run();
    if (result.changes !== 1) {
      throw new Response('task is not claimable', { status: 409 });
    }
    const task = tx.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get()!;
    const items = tx.select().from(translationTaskItems).where(eq(translationTaskItems.taskId, taskId)).all();
    return { task, items };
  });
}

export interface ResultItem {
  entryId: string;
  locale: string;
  value: string;
}

export function writeResults(taskId: string, results: ResultItem[], actorId: string): { applied: number } {
  const db = getDb();
  return db.transaction((tx) => {
    const task = tx.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get();
    if (!task) throw new Response('task not found', { status: 404 });
    if (task.status !== 'in_progress') {
      throw new Response(`task not in progress: ${task.status}`, { status: 409 });
    }
    const targetLocales = new Set(JSON.parse(task.targetLocales) as string[]);
    const items = tx.select().from(translationTaskItems).where(eq(translationTaskItems.taskId, taskId)).all();
    const allowedEntryIds = new Set(items.map((i) => i.entryId));
    for (const r of results) {
      if (!allowedEntryIds.has(r.entryId)) {
        throw new Response(`entry not in task: ${r.entryId}`, { status: 422 });
      }
      if (!targetLocales.has(r.locale)) {
        throw new Response(`locale not in target_locales: ${r.locale}`, { status: 422 });
      }
    }
    const ctx = { bundleVersionBumped: false };
    let applied = 0;
    for (const r of results) {
      writeTranslationInTx(
        tx as unknown as ReturnType<typeof getDb>,
        {
          entryId: r.entryId,
          locale: r.locale,
          value: r.value,
          source: 'task',
          status: 'draft',
          actorId,
          metadata: { task_id: taskId },
        },
        ctx,
      );
      applied++;
      // 标记 item done(若该 entry 所有 target_locale 已写)
      tx.update(translationTaskItems)
        .set({ status: 'done' })
        .where(and(eq(translationTaskItems.taskId, taskId), eq(translationTaskItems.entryId, r.entryId)))
        .run();
    }
    tx.update(translationTasks)
      .set({ done: task.done + applied, updatedAt: nowMs() })
      .where(eq(translationTasks.id, taskId))
      .run();
    return { applied };
  });
}

export function completeTask(taskId: string): TranslationTask {
  const db = getDb();
  return db.transaction((tx) => {
    const task = tx.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get();
    if (!task) throw new Response('task not found', { status: 404 });
    if (task.status !== 'in_progress') throw new Response(`task not in progress`, { status: 409 });
    const now = nowMs();
    tx.update(translationTasks)
      .set({ status: 'completed', completedAt: now, updatedAt: now })
      .where(eq(translationTasks.id, taskId))
      .run();
    return { ...task, status: 'completed', completedAt: now, updatedAt: now };
  });
}

export function failTask(taskId: string, reason: string): TranslationTask {
  const db = getDb();
  return db.transaction((tx) => {
    const task = tx.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get();
    if (!task) throw new Response('task not found', { status: 404 });
    if (task.status !== 'in_progress') throw new Response('task not in progress', { status: 409 });
    const now = nowMs();
    tx.update(translationTasks)
      .set({ status: 'failed', failedReason: reason, updatedAt: now })
      .where(eq(translationTasks.id, taskId))
      .run();
    return { ...task, status: 'failed', failedReason: reason, updatedAt: now };
  });
}

export function cancelTask(taskId: string): void {
  const db = getDb();
  db.transaction((tx) => {
    const task = tx.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get();
    if (!task) throw new Response('task not found', { status: 404 });
    if (task.status === 'completed' || task.status === 'cancelled') return;
    const now = nowMs();
    tx.update(translationTasks)
      .set({ status: 'cancelled', updatedAt: now })
      .where(eq(translationTasks.id, taskId))
      .run();
  });
}

export function getPayload(taskId: string): Record<string, string> {
  const db = getDb();
  const task = db.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get();
  if (!task) throw new Response('task not found', { status: 404 });
  const items = db.select().from(translationTaskItems).where(eq(translationTaskItems.taskId, taskId)).all();
  const payload: Record<string, string> = {};
  for (const it of items) payload[it.key] = it.sourceValue;
  return payload;
}
