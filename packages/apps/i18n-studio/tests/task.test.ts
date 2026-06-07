import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { setupTestDb, bootstrap, seedWorld, type TestCtx } from './helpers';

/**
 * 8.8 翻译任务生命周期:
 *  - filter / entry_ids 创建
 *  - create → claim → results(draft) → complete / fail / cancel
 *  - 重复 claim 拒绝
 *  - results 不影响 bundle_version
 */
describe('translation task lifecycle', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDb();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  async function seed() {
    const w = await seedWorld(ctx);
    const { entry } = ctx.api;
    // 写入若干有 zh-cn published 的词条
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

  it('使用 filter.prefix 创建任务,items 数量与 prefix 匹配', async () => {
    const w = await seed();
    const { task } = ctx.api;
    const t = task.createTask({
      namespaceId: w.docs.id,
      filter: { prefix: 'a.' },
      targetLocales: ['en-us'],
      sourceLocale: 'zh-cn',
      createdBy: w.alice.id,
    });
    expect(t.total).toBe(2);
    const got = task.getTask(t.id)!;
    expect(got.items.length).toBe(2);
    expect(got.items.every((i) => i.key.startsWith('a.'))).toBe(true);
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
      items.map((i) => ({ entryId: i.entryId, locale: 'en-us', value: `EN ${i.key}` })),
      w.alice.id,
    );
    expect(r.applied).toBe(2);
    // results 走 source=task / status=draft,bundle_version 不变
    const afterBv = db
      .getDb()
      .select()
      .from(schema.namespaces)
      .where(eq(schema.namespaces.id, w.docs.id))
      .get()!.bundleVersion;
    expect(afterBv).toBe(beforeBv);

    // 校验 translation 行为 draft
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
    // failed 后 complete 抛
    expect(() => task.completeTask(t.id)).toThrow();

    // cancel:从 failed 也允许进入 cancelled?当前实现:status==='completed' || 'cancelled' 直接幂等返回;否则置 cancelled
    expect(() => task.cancelTask(t.id)).not.toThrow();
    const after = task.getTask(t.id)!.task;
    expect(after.status).toBe('cancelled');
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
