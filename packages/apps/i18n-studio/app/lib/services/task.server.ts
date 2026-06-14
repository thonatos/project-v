import { eq, and, sql, desc } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import {
  entries,
  translations,
  translationTasks,
  translationTaskItems,
  translationTaskLogs,
  namespaces,
} from '~/db/schema';
import type { TranslationTask, TranslationTaskItem, TranslationTaskLog } from '~/db/schema';
import { getNamespaceLocales } from '~/lib/services/namespace.server';
import { writeTranslationInTx } from '~/lib/services/entry.server';
import { writeAuditEvent } from '~/lib/services/audit.server';
import { localeSchema, validateLocaleSubset } from '~/lib/validators';

export interface CreateTaskInput {
  namespaceId: string;
  filter?: { prefix?: string; missingLocale?: string };
  entryIds?: string[];
  targetLocales: string[];
  sourceLocale?: string;
  createdBy: string;
}

const DEFAULT_LEASE_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 3;

function taskItemKey(entryId: string, locale: string | null): string {
  return `${entryId}\u0000${locale}`;
}

function writeTaskLog(
  tx: ReturnType<typeof getDb>,
  input: {
    taskId: string;
    itemId?: string | null;
    event: 'create' | 'claim' | 'heartbeat' | 'result' | 'retry' | 'fail' | 'cancel' | 'complete';
    workerId?: string | null;
    actorId?: string | null;
    message?: string | null;
    metadata?: Record<string, unknown>;
  },
): void {
  tx.insert(translationTaskLogs)
    .values({
      id: newId(),
      taskId: input.taskId,
      itemId: input.itemId ?? null,
      event: input.event,
      workerId: input.workerId ?? null,
      actorId: input.actorId ?? null,
      message: input.message ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: nowMs(),
    })
    .run();
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
      total: candidates.length * input.targetLocales.length,
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
      for (const targetLocale of input.targetLocales) {
        tx.insert(translationTaskItems)
          .values({
            id: newId(),
            taskId,
            entryId: cand.id,
            targetLocale,
            key: cand.key,
            sourceValue: sourceTrans?.value ?? '',
            status: 'pending',
          })
          .run();
      }
    }

    writeTaskLog(tx as unknown as ReturnType<typeof getDb>, {
      taskId,
      event: 'create',
      actorId: input.createdBy,
      metadata: { itemCount: task.total, targetLocales: input.targetLocales },
    });

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

export interface TaskDetail {
  task: TranslationTask;
  items: TranslationTaskItem[];
  logs: TranslationTaskLog[];
  summary: {
    statusCounts: Record<string, number>;
    workerIds: string[];
    activeLeaseCount: number;
    nextLeaseExpiresAt: number | null;
    errorCount: number;
    errors: Array<{
      itemId: string;
      key: string;
      targetLocale: string | null;
      status: string;
      lastError: string;
    }>;
  };
}

export function getTaskDetail(taskId: string): TaskDetail | null {
  const db = getDb();
  const task = db.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get();
  if (!task) return null;
  const items = db.select().from(translationTaskItems).where(eq(translationTaskItems.taskId, taskId)).all();
  const logs = db
    .select()
    .from(translationTaskLogs)
    .where(eq(translationTaskLogs.taskId, taskId))
    .orderBy(desc(translationTaskLogs.createdAt))
    .all();
  const statusCounts: Record<string, number> = {};
  const workerIds = new Set<string>();
  let activeLeaseCount = 0;
  let nextLeaseExpiresAt: number | null = null;
  const errors: TaskDetail['summary']['errors'] = [];
  for (const item of items) {
    statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
    if (item.leasedBy) workerIds.add(item.leasedBy);
    if (item.status === 'in_progress' && item.leaseExpiresAt !== null) {
      activeLeaseCount++;
      nextLeaseExpiresAt =
        nextLeaseExpiresAt === null ? item.leaseExpiresAt : Math.min(nextLeaseExpiresAt, item.leaseExpiresAt);
    }
    if (item.lastError) {
      errors.push({
        itemId: item.id,
        key: item.key,
        targetLocale: item.targetLocale,
        status: item.status,
        lastError: item.lastError,
      });
    }
  }
  return {
    task,
    items,
    logs,
    summary: {
      statusCounts,
      workerIds: [...workerIds].sort(),
      activeLeaseCount,
      nextLeaseExpiresAt,
      errorCount: errors.length,
      errors,
    },
  };
}

export interface ClaimTaskOptions {
  leaseMs?: number;
  limit?: number;
}

export function claimTask(
  taskId: string,
  workerId: string,
  options: ClaimTaskOptions = {},
): { task: TranslationTask; items: TranslationTaskItem[] } {
  const db = getDb();
  return db.transaction((tx) => {
    const now = nowMs();
    const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
    const task = tx.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get();
    if (!task) throw new Response('task not found', { status: 404 });
    if (task.status !== 'pending' && task.status !== 'in_progress') {
      throw new Response('task is not claimable', { status: 409 });
    }

    const allItems = tx.select().from(translationTaskItems).where(eq(translationTaskItems.taskId, taskId)).all();
    const claimable = allItems.filter(
      (item) =>
        item.status === 'pending' ||
        (item.status === 'in_progress' && item.leaseExpiresAt !== null && item.leaseExpiresAt <= now),
    );
    const selectedItems = options.limit && options.limit > 0 ? claimable.slice(0, options.limit) : claimable;
    if (selectedItems.length === 0) {
      throw new Response('no claimable task items', { status: 409 });
    }
    const leaseExpiresAt = now + leaseMs;
    for (const item of selectedItems) {
      tx.update(translationTaskItems)
        .set({
          status: 'in_progress',
          leasedBy: workerId,
          leaseExpiresAt,
          attemptCount: item.attemptCount + 1,
        })
        .where(eq(translationTaskItems.id, item.id))
        .run();
    }
    tx.update(translationTasks)
      .set({
        status: 'in_progress',
        workerId,
        startedAt: task.startedAt ?? now,
        updatedAt: now,
      })
      .where(eq(translationTasks.id, taskId))
      .run();
    writeTaskLog(tx as unknown as ReturnType<typeof getDb>, {
      taskId,
      event: 'claim',
      workerId,
      metadata: { itemCount: selectedItems.length, leaseExpiresAt },
    });
    const updatedTask = tx.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get()!;
    const itemIds = new Set(selectedItems.map((item) => item.id));
    const updatedItems = tx
      .select()
      .from(translationTaskItems)
      .where(eq(translationTaskItems.taskId, taskId))
      .all()
      .filter((item) => itemIds.has(item.id));
    return { task: updatedTask, items: updatedItems };
  });
}

export function heartbeatTask(
  taskId: string,
  workerId: string,
  options: { leaseMs?: number } = {},
): { task: TranslationTask; items: TranslationTaskItem[]; leaseExpiresAt: number } {
  const db = getDb();
  return db.transaction((tx) => {
    const now = nowMs();
    const leaseExpiresAt = now + (options.leaseMs ?? DEFAULT_LEASE_MS);
    const task = tx.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get();
    if (!task) throw new Response('task not found', { status: 404 });
    if (task.status !== 'in_progress') throw new Response('task not in progress', { status: 409 });

    const items = tx
      .select()
      .from(translationTaskItems)
      .where(eq(translationTaskItems.taskId, taskId))
      .all()
      .filter(
        (item) =>
          item.status === 'in_progress' &&
          item.leasedBy === workerId &&
          item.leaseExpiresAt !== null &&
          item.leaseExpiresAt > now,
      );
    if (items.length === 0) {
      throw new Response('no active lease for worker', { status: 409 });
    }
    for (const item of items) {
      tx.update(translationTaskItems).set({ leaseExpiresAt }).where(eq(translationTaskItems.id, item.id)).run();
    }
    tx.update(translationTasks).set({ updatedAt: now }).where(eq(translationTasks.id, taskId)).run();
    writeTaskLog(tx as unknown as ReturnType<typeof getDb>, {
      taskId,
      event: 'heartbeat',
      workerId,
      metadata: { itemCount: items.length, leaseExpiresAt },
    });
    const updatedTask = tx.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get()!;
    const itemIds = new Set(items.map((item) => item.id));
    const updatedItems = tx
      .select()
      .from(translationTaskItems)
      .where(eq(translationTaskItems.taskId, taskId))
      .all()
      .filter((item) => itemIds.has(item.id));
    return { task: updatedTask, items: updatedItems, leaseExpiresAt };
  });
}

export interface ResultItem {
  entryId: string;
  locale: string;
  value: string;
}

export function writeResults(taskId: string, results: ResultItem[], actorId: string): { applied: number } {
  const db = getDb();
  const validationFailure: {
    current: { taskId: string; itemId?: string | null; message: string; metadata: Record<string, unknown> } | null;
  } = { current: null };
  try {
    return db.transaction((tx) => {
      const task = tx.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get();
      if (!task) throw new Response('task not found', { status: 404 });
      if (task.status !== 'in_progress') {
        throw new Response(`task not in progress: ${task.status}`, { status: 409 });
      }
      const targetLocales = new Set(JSON.parse(task.targetLocales) as string[]);
      const items = tx.select().from(translationTaskItems).where(eq(translationTaskItems.taskId, taskId)).all();
      const itemByEntryLocale = new Map(items.map((i) => [taskItemKey(i.entryId, i.targetLocale), i]));
      for (const r of results) {
        if (!targetLocales.has(r.locale)) {
          validationFailure.current = {
            taskId,
            message: `locale not in target_locales: ${r.locale}`,
            metadata: { entryId: r.entryId, locale: r.locale },
          };
          throw new Response(`locale not in target_locales: ${r.locale}`, { status: 422 });
        }
        if (!itemByEntryLocale.has(taskItemKey(r.entryId, r.locale))) {
          validationFailure.current = {
            taskId,
            message: `entry/locale not in task: ${r.entryId}/${r.locale}`,
            metadata: { entryId: r.entryId, locale: r.locale },
          };
          throw new Response(`entry/locale not in task: ${r.entryId}/${r.locale}`, { status: 422 });
        }
      }
      const ctx = { bundleVersionBumped: false };
      let applied = 0;
      let newlyCompleted = 0;
      const completedThisBatch = new Set<string>();
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
        const itemKey = taskItemKey(r.entryId, r.locale);
        const item = itemByEntryLocale.get(itemKey)!;
        if (item.status !== 'completed' && item.status !== 'done' && !completedThisBatch.has(itemKey)) {
          newlyCompleted++;
          completedThisBatch.add(itemKey);
        }
        tx.update(translationTaskItems)
          .set({ status: 'completed', completedAt: nowMs() })
          .where(
            and(
              eq(translationTaskItems.taskId, taskId),
              eq(translationTaskItems.entryId, r.entryId),
              eq(translationTaskItems.targetLocale, r.locale),
            ),
          )
          .run();
        writeTaskLog(tx as unknown as ReturnType<typeof getDb>, {
          taskId,
          itemId: item.id,
          event: 'result',
          actorId,
          metadata: { entryId: r.entryId, locale: r.locale },
        });
      }
      const updatedDone = task.done + newlyCompleted;
      const taskPatch: Partial<TranslationTask> = { done: updatedDone, updatedAt: nowMs() };
      if (updatedDone >= task.total) {
        const completedAt = nowMs();
        taskPatch.status = 'completed';
        taskPatch.completedAt = completedAt;
        writeTaskLog(tx as unknown as ReturnType<typeof getDb>, {
          taskId,
          event: 'complete',
          actorId,
          metadata: { done: updatedDone, total: task.total },
        });
      }
      tx.update(translationTasks).set(taskPatch).where(eq(translationTasks.id, taskId)).run();
      writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
        namespaceId: task.namespaceId,
        actorId,
        action: 'task.results',
        resourceType: 'translation_task',
        resourceId: taskId,
        metadata: { applied, resultCount: results.length, targetLocales: [...targetLocales] },
      });
      return { applied };
    });
  } catch (error) {
    if (validationFailure.current) {
      writeTaskLog(db, {
        taskId: validationFailure.current.taskId,
        itemId: validationFailure.current.itemId,
        event: 'fail',
        actorId,
        message: validationFailure.current.message,
        metadata: validationFailure.current.metadata,
      });
    }
    throw error;
  }
}

export function completeTask(taskId: string): TranslationTask {
  const db = getDb();
  return db.transaction((tx) => {
    const task = tx.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get();
    if (!task) throw new Response('task not found', { status: 404 });
    if (task.status === 'completed') return task;
    if (task.status !== 'in_progress') throw new Response(`task not in progress`, { status: 409 });
    if (task.done < task.total) throw new Response(`task has incomplete items`, { status: 409 });
    const now = nowMs();
    tx.update(translationTasks)
      .set({ status: 'completed', completedAt: now, updatedAt: now })
      .where(eq(translationTasks.id, taskId))
      .run();
    writeTaskLog(tx as unknown as ReturnType<typeof getDb>, {
      taskId,
      event: 'complete',
      metadata: { done: task.done, total: task.total },
    });
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
    const items = tx.select().from(translationTaskItems).where(eq(translationTaskItems.taskId, taskId)).all();
    for (const item of items) {
      if (item.status === 'completed' || item.status === 'done') continue;
      tx.update(translationTaskItems)
        .set({ status: 'failed', lastError: reason, leasedBy: null, leaseExpiresAt: null })
        .where(eq(translationTaskItems.id, item.id))
        .run();
    }
    tx.update(translationTasks)
      .set({ status: 'failed', failedReason: reason, updatedAt: now })
      .where(eq(translationTasks.id, taskId))
      .run();
    writeTaskLog(tx as unknown as ReturnType<typeof getDb>, {
      taskId,
      event: 'fail',
      message: reason,
      metadata: { failedItems: items.filter((item) => item.status !== 'completed' && item.status !== 'done').length },
    });
    return { ...task, status: 'failed', failedReason: reason, updatedAt: now };
  });
}

export function retryTaskItem(
  taskId: string,
  itemId: string,
  actorId: string,
  options: { maxAttempts?: number } = {},
): TranslationTaskItem {
  const db = getDb();
  return db.transaction((tx) => {
    const task = tx.select().from(translationTasks).where(eq(translationTasks.id, taskId)).get();
    if (!task) throw new Response('task not found', { status: 404 });
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new Response(`task is not retryable: ${task.status}`, { status: 409 });
    }
    const item = tx.select().from(translationTaskItems).where(eq(translationTaskItems.id, itemId)).get();
    if (!item || item.taskId !== taskId) throw new Response('task item not found', { status: 404 });
    if (item.status !== 'failed') throw new Response(`task item is not failed: ${item.status}`, { status: 409 });
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    if (item.attemptCount >= maxAttempts) {
      throw new Response(`task item reached max attempts`, { status: 409 });
    }
    tx.update(translationTaskItems)
      .set({
        status: 'pending',
        leasedBy: null,
        leaseExpiresAt: null,
        lastError: null,
        completedAt: null,
      })
      .where(eq(translationTaskItems.id, item.id))
      .run();
    tx.update(translationTasks)
      .set({ status: 'in_progress', failedReason: null, updatedAt: nowMs() })
      .where(eq(translationTasks.id, taskId))
      .run();
    writeTaskLog(tx as unknown as ReturnType<typeof getDb>, {
      taskId,
      itemId,
      event: 'retry',
      actorId,
      metadata: { attemptCount: item.attemptCount, maxAttempts },
    });
    return tx.select().from(translationTaskItems).where(eq(translationTaskItems.id, item.id)).get()!;
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
    writeTaskLog(tx as unknown as ReturnType<typeof getDb>, {
      taskId,
      event: 'cancel',
      metadata: { previousStatus: task.status },
    });
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
