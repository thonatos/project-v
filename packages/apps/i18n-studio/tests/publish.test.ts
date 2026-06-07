import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { setupTestDb, bootstrap, seedWorld, type TestCtx } from './helpers';

/**
 * 8.7 Publish / Discard:
 *  - 单条 publish ✓
 *  - 批量 publish 共用一次 bundle_version+1 ✓
 *  - 不存在的 draft 报错
 *  - 已 discarded 不可 publish
 *  - discard 之后再 publish 报错
 */
describe('publish/discard', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDb();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  async function makeDrafts(): Promise<{ entryId: string; aliceId: string; nsId: string }> {
    const w = await seedWorld(ctx);
    const { entry } = ctx.api;
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'a',
      translations: { 'zh-cn': 'd1', 'en-us': 'd1' },
      asDraft: true,
      actorId: w.alice.id,
    });
    const e = entry.getEntryByKey(w.docs.id, 'a')!;
    return { entryId: e.id, aliceId: w.alice.id, nsId: w.docs.id };
  }

  it('单条 publish:status: draft → published,bundleVersion+1', async () => {
    const { entryId, aliceId, nsId } = await makeDrafts();
    const { publish, db, schema } = ctx.api;
    const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, nsId)).get()!;
    publish.publishOne(entryId, 'zh-cn', 1, aliceId);
    const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, nsId)).get()!;
    expect(after.bundleVersion).toBe(before.bundleVersion + 1);
  });

  it('批量 publish:N 条共用一次 bundle_version+1', async () => {
    const { entryId, aliceId, nsId } = await makeDrafts();
    const { publish, db, schema } = ctx.api;
    const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, nsId)).get()!;
    const r = publish.publishBatch(
      [
        { entryId, locale: 'zh-cn', version: 1 },
        { entryId, locale: 'en-us', version: 1 },
      ],
      aliceId,
    );
    expect(r.published).toBe(2);
    const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, nsId)).get()!;
    expect(after.bundleVersion).toBe(before.bundleVersion + 1);
  });

  it('不存在的 draft → 抛 404 Response', async () => {
    const { entryId, aliceId } = await makeDrafts();
    const { publish } = ctx.api;
    expect(() => publish.publishOne(entryId, 'zh-cn', 999, aliceId)).toThrow();
  });

  it('已 discarded 的版本不可 publish', async () => {
    const { entryId, aliceId } = await makeDrafts();
    const { publish } = ctx.api;
    publish.discard(entryId, 'zh-cn', 1, aliceId);
    expect(() => publish.publishOne(entryId, 'zh-cn', 1, aliceId)).toThrow();
  });

  it('discard 仅作用于 draft;对 published 报错', async () => {
    const { entryId, aliceId } = await makeDrafts();
    const { publish } = ctx.api;
    publish.publishOne(entryId, 'zh-cn', 1, aliceId);
    expect(() => publish.discard(entryId, 'zh-cn', 1, aliceId)).toThrow();
  });

  it('discard 不递增 bundle_version', async () => {
    const { entryId, aliceId, nsId } = await makeDrafts();
    const { publish, db, schema } = ctx.api;
    const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, nsId)).get()!;
    publish.discard(entryId, 'zh-cn', 1, aliceId);
    const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, nsId)).get()!;
    expect(after.bundleVersion).toBe(before.bundleVersion);
  });
});
