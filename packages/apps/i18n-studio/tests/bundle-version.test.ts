import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';

import { setupTestDb, bootstrap, seedWorld, type TestCtx } from './helpers';
import * as schema from '~/db/schema';

/**
 * 8.14 bundle_version 并发 +1:
 *  - 串行两次写入 → +2
 *  - 两个独立 sqlite 连接对同一 namespace 各自 UPDATE bundle_version + 1
 *    最终值 = 起点 + 2(SQL 原子表达式 + WAL 写串行化保证)
 */
describe('bundle_version concurrent +1', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDb();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  it('串行两次 published 写入 → +2', async () => {
    const w = await seedWorld(ctx);
    const { entry, db } = ctx.api;
    const d = db.getDb();
    const before = d.select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'a',
      translations: { 'zh-cn': '1' },
      actorId: w.alice.id,
    });
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'b',
      translations: { 'zh-cn': '1' },
      actorId: w.alice.id,
    });
    const after = d.select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
    expect(after.bundleVersion).toBe(before.bundleVersion + 2);
  });

  it('两个独立连接的原子 +1 不丢失更新', async () => {
    const w = await seedWorld(ctx);
    const { db } = ctx.api;
    const d = db.getDb();
    const before = d.select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;

    const a = new Database(ctx.env.dbFile);
    const b = new Database(ctx.env.dbFile);
    a.pragma('busy_timeout = 5000');
    b.pragma('busy_timeout = 5000');
    const stmtA = a.prepare('UPDATE namespaces SET bundle_version = bundle_version + 1 WHERE id = ?');
    const stmtB = b.prepare('UPDATE namespaces SET bundle_version = bundle_version + 1 WHERE id = ?');
    stmtA.run(w.docs.id);
    stmtB.run(w.docs.id);
    a.close();
    b.close();

    const after = d.select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
    expect(after.bundleVersion).toBe(before.bundleVersion + 2);
  });
});
