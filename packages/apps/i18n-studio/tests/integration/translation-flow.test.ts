import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { setupTestDbFromTemplate, bootstrap, seedWorld, type TestCtx } from '../helpers';

describe('translation flow', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDbFromTemplate();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  describe('task lifecycle', () => {
    async function seed() {
      const w = await seedWorld(ctx);
      const { entry } = ctx.api;
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a.b',
        translations: { 'zh-cn': '中A' },
        actorId: w.alice.id,
      });
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a.c',
        translations: { 'zh-cn': '中B' },
        actorId: w.alice.id,
      });
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'x.y',
        translations: { 'zh-cn': '另一组' },
        actorId: w.alice.id,
      });
      return w;
    }

    it('使用 filter.prefix 创建任务,按 entry 和 target locale 生成 items', async () => {
      const w = await seed();
      const { task } = ctx.api;
      const t = task.createTask({
        namespaceId: w.docs.id,
        filter: { prefix: 'a.' },
        targetLocales: ['zh-tw', 'en-us'],
        sourceLocale: 'zh-cn',
        createdBy: w.alice.id,
      });
      expect(t.total).toBe(4);
      const got = task.getTask(t.id)!;
      expect(got.items.length).toBe(4);
      expect(got.items.every((i) => i.key.startsWith('a.'))).toBe(true);
      expect(got.items.filter((i) => i.targetLocale === 'zh-tw')).toHaveLength(2);
      expect(got.items.filter((i) => i.targetLocale === 'en-us')).toHaveLength(2);
    });

    it('使用 entry_ids 创建任务;非本 ns 的 id → 422', async () => {
      const w = await seed();
      const { entry, task } = ctx.api;
      const e1 = entry.getEntryByKey(w.docs.id, 'a.b')!;
      const e2 = entry.getEntryByKey(w.docs.id, 'x.y')!;
      const t = task.createTask({
        namespaceId: w.docs.id,
        entryIds: [e1.id, e2.id],
        targetLocales: ['en-us'],
        sourceLocale: 'zh-cn',
        createdBy: w.alice.id,
      });
      expect(t.total).toBe(2);
      expect(() =>
        task.createTask({
          namespaceId: w.docs.id,
          entryIds: ['not-in-ns'],
          targetLocales: ['en-us'],
          sourceLocale: 'zh-cn',
          createdBy: w.alice.id,
        }),
      ).toThrow();
    });

    it('完整生命周期:create → claim → writeResults(draft) → complete', async () => {
      const w = await seed();
      const { task, entry, db, schema } = ctx.api;
      const t = task.createTask({
        namespaceId: w.docs.id,
        filter: { prefix: 'a.' },
        targetLocales: ['en-us'],
        sourceLocale: 'zh-cn',
        createdBy: w.alice.id,
      });
      const beforeBv = db
        .getDb()
        .select()
        .from(schema.namespaces)
        .where(eq(schema.namespaces.id, w.docs.id))
        .get()!.bundleVersion;
      const claimed = task.claimTask(t.id, 'worker-1');
      expect(claimed.task.status).toBe('in_progress');
      expect(claimed.task.workerId).toBe('worker-1');

      const items = claimed.items;
      const r = task.writeResults(
        t.id,
        items.map((i) => ({ entryId: i.entryId, locale: i.targetLocale ?? 'en-us', value: `EN ${i.key}` })),
        w.alice.id,
      );
      expect(r.applied).toBe(2);
      const afterWrite = task.getTask(t.id)!;
      expect(afterWrite.task.done).toBe(2);
      expect(afterWrite.task.status).toBe('completed');
      expect(afterWrite.task.completedAt).toBeTruthy();
      expect(afterWrite.items.every((i) => i.status === 'completed')).toBe(true);
      const afterBv = db
        .getDb()
        .select()
        .from(schema.namespaces)
        .where(eq(schema.namespaces.id, w.docs.id))
        .get()!.bundleVersion;
      expect(afterBv).toBe(beforeBv);

      const e = entry.getEntryByKey(w.docs.id, 'a.b')!;
      const versions = ctx.api.version.listVersions(e.id, 'en-us');
      expect(versions.versions[0]?.status).toBe('draft');
      expect(versions.versions[0]?.source).toBe('task');

      const completed = task.completeTask(t.id);
      expect(completed.status).toBe('completed');
    });

    it('重复 claim:第二次 → 409', async () => {
      const w = await seed();
      const { task } = ctx.api;
      const t = task.createTask({
        namespaceId: w.docs.id,
        filter: { prefix: 'a.' },
        targetLocales: ['en-us'],
        sourceLocale: 'zh-cn',
        createdBy: w.alice.id,
      });
      task.claimTask(t.id, 'w1');
      expect(() => task.claimTask(t.id, 'w2')).toThrow();
    });

    it('claim 设置 item lease,heartbeat 续租,过期后可重领', async () => {
      const w = await seed();
      const { task, db, schema } = ctx.api;
      const t = task.createTask({
        namespaceId: w.docs.id,
        filter: { prefix: 'a.b' },
        targetLocales: ['en-us'],
        sourceLocale: 'zh-cn',
        createdBy: w.alice.id,
      });

      const claimed = task.claimTask(t.id, 'w1', { leaseMs: 1_000 });
      expect(claimed.items).toHaveLength(1);
      expect(claimed.items[0]!.status).toBe('in_progress');
      expect(claimed.items[0]!.leasedBy).toBe('w1');
      expect(claimed.items[0]!.attemptCount).toBe(1);
      expect(claimed.items[0]!.leaseExpiresAt).toBeGreaterThan(Date.now());
      expect(() => task.claimTask(t.id, 'w2', { leaseMs: 1_000 })).toThrow();

      const heartbeat = task.heartbeatTask(t.id, 'w1', { leaseMs: 5_000 });
      expect(heartbeat.items).toHaveLength(1);
      expect(heartbeat.items[0]!.leaseExpiresAt).toBeGreaterThan(claimed.items[0]!.leaseExpiresAt!);

      db.getDb()
        .update(schema.translationTaskItems)
        .set({ leaseExpiresAt: Date.now() - 1_000 })
        .where(eq(schema.translationTaskItems.id, claimed.items[0]!.id))
        .run();

      const reclaimed = task.claimTask(t.id, 'w2', { leaseMs: 1_000 });
      expect(reclaimed.items).toHaveLength(1);
      expect(reclaimed.items[0]!.leasedBy).toBe('w2');
      expect(reclaimed.items[0]!.attemptCount).toBe(2);
      expect(() => task.heartbeatTask(t.id, 'w1', { leaseMs: 1_000 })).toThrow();

      const logs = db
        .getDb()
        .select()
        .from(schema.translationTaskLogs)
        .where(eq(schema.translationTaskLogs.taskId, t.id))
        .all();
      expect(logs.some((log) => log.event === 'claim' && log.workerId === 'w1')).toBe(true);
      expect(logs.some((log) => log.event === 'heartbeat' && log.workerId === 'w1')).toBe(true);
      expect(logs.some((log) => log.event === 'claim' && log.workerId === 'w2')).toBe(true);
      const detail = task.getTaskDetail(t.id)!;
      expect(detail.summary.statusCounts.in_progress).toBe(1);
      expect(detail.summary.workerIds).toEqual(['w2']);
      expect(detail.summary.activeLeaseCount).toBe(1);
      expect(detail.logs.length).toBeGreaterThanOrEqual(4);
    });

    it('fail 流转 + cancel(对完成态幂等)', async () => {
      const w = await seed();
      const { task } = ctx.api;
      const t = task.createTask({
        namespaceId: w.docs.id,
        filter: { prefix: 'a.' },
        targetLocales: ['en-us'],
        sourceLocale: 'zh-cn',
        createdBy: w.alice.id,
      });
      task.claimTask(t.id, 'w1');
      const f = task.failTask(t.id, 'no provider');
      expect(f.status).toBe('failed');
      expect(f.failedReason).toBe('no provider');
      expect(() => task.completeTask(t.id)).toThrow();

      expect(() => task.cancelTask(t.id)).not.toThrow();
      const after = task.getTask(t.id)!.task;
      expect(after.status).toBe('cancelled');
      const logs = ctx.api.db
        .getDb()
        .select()
        .from(ctx.api.schema.translationTaskLogs)
        .where(eq(ctx.api.schema.translationTaskLogs.taskId, t.id))
        .all();
      expect(logs.some((log) => log.event === 'fail' && log.message === 'no provider')).toBe(true);
      expect(logs.some((log) => log.event === 'cancel')).toBe(true);
    });

    it('failed item 可 retry 并重新 claim', async () => {
      const w = await seed();
      const { task } = ctx.api;
      const t = task.createTask({
        namespaceId: w.docs.id,
        filter: { prefix: 'a.b' },
        targetLocales: ['en-us'],
        sourceLocale: 'zh-cn',
        createdBy: w.alice.id,
      });
      task.claimTask(t.id, 'w1');
      task.failTask(t.id, 'provider timeout');
      const failed = task.getTask(t.id)!;
      expect(failed.task.status).toBe('failed');
      expect(failed.items[0]!.status).toBe('failed');
      expect(failed.items[0]!.lastError).toBe('provider timeout');

      const retried = task.retryTaskItem(t.id, failed.items[0]!.id, w.alice.id);
      expect(retried.status).toBe('pending');
      expect(retried.lastError).toBeNull();
      const reclaimed = task.claimTask(t.id, 'w2');
      expect(reclaimed.items[0]!.leasedBy).toBe('w2');
      expect(reclaimed.items[0]!.attemptCount).toBe(2);
    });

    it('writeResults 校验:locale 不在 target_locales / entry_id 不在任务 → 422', async () => {
      const w = await seed();
      const { task, entry } = ctx.api;
      const t = task.createTask({
        namespaceId: w.docs.id,
        filter: { prefix: 'a.' },
        targetLocales: ['en-us'],
        sourceLocale: 'zh-cn',
        createdBy: w.alice.id,
      });
      task.claimTask(t.id, 'w1');
      const e = entry.getEntryByKey(w.docs.id, 'a.b')!;
      expect(() => task.writeResults(t.id, [{ entryId: e.id, locale: 'zh-tw', value: 'X' }], w.alice.id)).toThrow();
      const xy = entry.getEntryByKey(w.docs.id, 'x.y')!;
      expect(() => task.writeResults(t.id, [{ entryId: xy.id, locale: 'en-us', value: 'X' }], w.alice.id)).toThrow();
      const logs = ctx.api.db
        .getDb()
        .select()
        .from(ctx.api.schema.translationTaskLogs)
        .where(eq(ctx.api.schema.translationTaskLogs.taskId, t.id))
        .all();
      expect(logs.filter((log) => log.event === 'fail')).toHaveLength(2);
    });

    it('writeResults 只完成对应 locale item', async () => {
      const w = await seed();
      const { task, entry } = ctx.api;
      const t = task.createTask({
        namespaceId: w.docs.id,
        entryIds: [entry.getEntryByKey(w.docs.id, 'a.b')!.id],
        targetLocales: ['zh-tw', 'en-us'],
        sourceLocale: 'zh-cn',
        createdBy: w.alice.id,
      });
      task.claimTask(t.id, 'w1');
      const e = entry.getEntryByKey(w.docs.id, 'a.b')!;

      const r = task.writeResults(t.id, [{ entryId: e.id, locale: 'en-us', value: 'English' }], w.alice.id);

      expect(r.applied).toBe(1);
      const got = task.getTask(t.id)!;
      expect(got.task.done).toBe(1);
      expect(got.task.status).toBe('in_progress');
      expect(got.items.find((i) => i.targetLocale === 'en-us')?.status).toBe('completed');
      expect(got.items.find((i) => i.targetLocale === 'zh-tw')?.status).toBe('in_progress');
      expect(() => task.completeTask(t.id)).toThrow();
      expect(ctx.api.version.listVersions(e.id, 'en-us').versions[0]?.status).toBe('draft');
      expect(ctx.api.version.listVersions(e.id, 'en-us').versions[0]?.value).toBe('English');
      expect(ctx.api.version.listVersions(e.id, 'zh-tw').versions).toHaveLength(0);

      const logs = ctx.api.db
        .getDb()
        .select()
        .from(ctx.api.schema.translationTaskLogs)
        .where(eq(ctx.api.schema.translationTaskLogs.taskId, t.id))
        .all();
      const enItem = got.items.find((i) => i.targetLocale === 'en-us')!;
      expect(logs.some((log) => log.event === 'result' && log.itemId === enItem.id)).toBe(true);
    });

    it('getPayload 返回 flat JSON', async () => {
      const w = await seed();
      const { task } = ctx.api;
      const t = task.createTask({
        namespaceId: w.docs.id,
        filter: { prefix: 'a.' },
        targetLocales: ['en-us'],
        sourceLocale: 'zh-cn',
        createdBy: w.alice.id,
      });
      const p = task.getPayload(t.id);
      expect(p['a.b']).toBe('中A');
      expect(p['a.c']).toBe('中B');
    });
  });

  describe('cross-namespace sync', () => {
    async function seed() {
      const w = await seedWorld(ctx);
      const { entry } = ctx.api;
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a.b',
        translations: { 'zh-cn': '中AB', 'en-us': 'EN-AB' },
        actorId: w.alice.id,
      });
      entry.upsertEntry({
        namespaceId: w.docs.id,
        key: 'a.c',
        translations: { 'zh-cn': '中AC' },
        actorId: w.alice.id,
      });
      entry.upsertEntry({
        namespaceId: w.artx.id,
        key: 'a.b',
        translations: { 'zh-cn': '原-AB' },
        actorId: w.alice.id,
      });
      return w;
    }

    it('dry_run:返回计划但不写入', async () => {
      const w = await seed();
      const { sync, db, schema } = ctx.api;
      const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.artx.id)).get()!;
      const plan = sync.syncSpaces({
        sourceSlug: 'docs',
        targetSlug: 'artx',
        locales: ['zh-cn'],
        strategy: 'overwrite',
        dryRun: true,
        actorId: w.alice.id,
      }) as { toCreate: number; toUpdate: number; toSkip: number };
      expect(plan.toCreate + plan.toUpdate + plan.toSkip).toBeGreaterThan(0);
      const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.artx.id)).get()!;
      expect(after.bundleVersion).toBe(before.bundleVersion);
    });

    it('strategy=overwrite + auto_publish:覆盖既有 published,共用一次 bundle_version+1', async () => {
      const w = await seed();
      const { sync, db, schema } = ctx.api;
      const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.artx.id)).get()!;
      const r = sync.syncSpaces({
        sourceSlug: 'docs',
        targetSlug: 'artx',
        locales: ['zh-cn'],
        strategy: 'overwrite',
        autoPublish: true,
        actorId: w.alice.id,
      }) as { created: number; updated: number; skipped: number; bundleVersion?: number };
      expect(r.updated).toBeGreaterThanOrEqual(1);
      const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.artx.id)).get()!;
      expect(after.bundleVersion).toBe(before.bundleVersion + 1);
    });

    it('strategy=fill_missing:仅在 target 没有 published 时写入', async () => {
      const w = await seed();
      const { sync, entry, db, schema } = ctx.api;
      const r = sync.syncSpaces({
        sourceSlug: 'docs',
        targetSlug: 'artx',
        locales: ['zh-cn'],
        strategy: 'fill_missing',
        autoPublish: true,
        actorId: w.alice.id,
      }) as { created: number; updated: number; skipped: number };
      expect(r.created).toBe(1);
      expect(r.skipped).toBeGreaterThanOrEqual(1);
      expect(r.updated).toBe(0);
      const ab = entry.getEntryByKey(w.artx.id, 'a.b')!;
      const t = db.getDb().select().from(schema.translations).where(eq(schema.translations.entryId, ab.id)).all();
      expect(t.find((x) => x.locale === 'zh-cn')?.value).toBe('原-AB');
    });

    it('strategy=skip:target 存在 entry → 整 entry skip', async () => {
      const w = await seed();
      const { sync, entry } = ctx.api;
      sync.syncSpaces({
        sourceSlug: 'docs',
        targetSlug: 'artx',
        locales: ['zh-cn'],
        strategy: 'skip',
        autoPublish: true,
        actorId: w.alice.id,
      }) as unknown;
      const ac = entry.getEntryByKey(w.artx.id, 'a.c');
      expect(ac).toBeTruthy();
      expect(entry.getEntryByKey(w.artx.id, 'a.b')!.id).toBeTruthy();
    });

    it('entry_ids 白名单:仅同步指定 id,不在 source 内的 id → 422', async () => {
      const w = await seed();
      const { sync, entry } = ctx.api;
      const ab = entry.getEntryByKey(w.docs.id, 'a.b')!;
      const r = sync.syncSpaces({
        sourceSlug: 'docs',
        targetSlug: 'artx',
        entryIds: [ab.id],
        locales: ['zh-cn'],
        strategy: 'overwrite',
        autoPublish: true,
        actorId: w.alice.id,
      }) as { created: number; updated: number; skipped: number };
      expect(r.created + r.updated).toBe(1);
      expect(() =>
        sync.syncSpaces({
          sourceSlug: 'docs',
          targetSlug: 'artx',
          entryIds: ['not-in-docs'],
          locales: ['zh-cn'],
          strategy: 'overwrite',
          actorId: w.alice.id,
        }),
      ).toThrow();
    });

    it('autoPublish=false:写入 draft,不递增 bundle_version', async () => {
      const w = await seed();
      const { sync, entry, version: ver, db, schema } = ctx.api;
      const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.artx.id)).get()!;
      sync.syncSpaces({
        sourceSlug: 'docs',
        targetSlug: 'artx',
        locales: ['zh-cn'],
        strategy: 'overwrite',
        autoPublish: false,
        actorId: w.alice.id,
      });
      const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.artx.id)).get()!;
      expect(after.bundleVersion).toBe(before.bundleVersion);
      const ac = entry.getEntryByKey(w.artx.id, 'a.c')!;
      const h = ver.listVersions(ac.id, 'zh-cn');
      expect(h.versions[0]?.status).toBe('draft');
      expect(h.versions[0]?.source).toBe('sync');
    });

    it('locale 未在目标 ns 启用 → 422', async () => {
      const w = await seed();
      const { sync } = ctx.api;
      expect(() =>
        sync.syncSpaces({
          sourceSlug: 'docs',
          targetSlug: 'artx',
          locales: ['zh-tw'],
          strategy: 'overwrite',
          actorId: w.alice.id,
        }),
      ).toThrow();
    });
  });
});
