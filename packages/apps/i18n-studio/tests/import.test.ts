import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq, and } from 'drizzle-orm';

import { setupTestDb, bootstrap, seedWorld, type TestCtx } from './helpers';

/**
 * 8.4 批量导入:
 *  - 预校验失败回滚(任一非法 key/locale → 整批不写入)
 *  - 成功路径
 *  - 单批 10000 条上限
 *  - as_draft 路径(不 +bundle_version)
 */
describe('importFlat', () => {
  let ctx: TestCtx;

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDb();
    ctx = await bootstrap(env);
  });
  afterEach(() => ctx.env.cleanup());

  it('成功路径:写入 N 条 published,bundleVersion +1(批共享一次)', async () => {
    const w = await seedWorld(ctx);
    const { entry, db, schema } = ctx.api;
    const r = entry.importFlat({
      namespaceId: w.docs.id,
      locale: 'zh-cn',
      entries: { 'a.b': '1', 'a.c': '2', d: '3' },
      actorId: w.alice.id,
    });
    expect(r.ok).toBe(true);
    expect(r.imported).toBe(3);
    expect(r.total).toBe(3);
    const ns = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
    expect(ns.bundleVersion).toBe(1);
  });

  it('预校验失败:任一非法 key 整批回滚,bundleVersion 不变', async () => {
    const w = await seedWorld(ctx);
    const { entry, db, schema } = ctx.api;
    const before = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
    const r = entry.importFlat({
      namespaceId: w.docs.id,
      locale: 'zh-cn',
      entries: { 'a.b': '1', '': 'x', '.bad.': 'y' },
      actorId: w.alice.id,
    });
    expect(r.ok).toBe(false);
    expect(r.imported).toBe(0);
    expect(r.errors.length).toBeGreaterThan(0);
    // 不应有任何 entry 写入
    const rows = db.getDb().select().from(schema.entries).where(eq(schema.entries.namespaceId, w.docs.id)).all();
    expect(rows.length).toBe(0);
    const after = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
    expect(after.bundleVersion).toBe(before.bundleVersion);
  });

  it('未启用的 locale → ok:false', async () => {
    const w = await seedWorld(ctx);
    const r = ctx.api.entry.importFlat({
      namespaceId: w.docs.id,
      locale: 'fr-fr',
      entries: { a: 'b' },
      actorId: w.alice.id,
    });
    expect(r.ok).toBe(false);
    expect(r.errors[0]?.reason).toMatch(/locale 未启用/);
  });

  it('超过 10000 条上限:整批拒绝', async () => {
    const w = await seedWorld(ctx);
    const big: Record<string, string> = {};
    for (let i = 0; i < 10001; i++) big[`k.${i}`] = String(i);
    const r = ctx.api.entry.importFlat({
      namespaceId: w.docs.id,
      locale: 'zh-cn',
      entries: big,
      actorId: w.alice.id,
    });
    expect(r.ok).toBe(false);
    expect(r.imported).toBe(0);
    expect(r.errors[0]?.reason).toMatch(/上限/);
  });

  it('as_draft=true:写入但 bundleVersion 不递增,translation 行为 draft', async () => {
    const w = await seedWorld(ctx);
    const { entry, version: ver, db, schema } = ctx.api;
    entry.importFlat({
      namespaceId: w.docs.id,
      locale: 'zh-cn',
      entries: { 'a.b': '1', c: '2' },
      asDraft: true,
      actorId: w.alice.id,
    });
    const ns = db.getDb().select().from(schema.namespaces).where(eq(schema.namespaces.id, w.docs.id)).get()!;
    expect(ns.bundleVersion).toBe(0);
    const e = entry.getEntryByKey(w.docs.id, 'a.b')!;
    const tv = db
      .getDb()
      .select()
      .from(schema.translationVersions)
      .where(and(eq(schema.translationVersions.entryId, e.id), eq(schema.translationVersions.locale, 'zh-cn')))
      .all();
    expect(tv.every((r) => r.status === 'draft')).toBe(true);
    // listVersions 第一条应为 draft v1
    const h = ver.listVersions(e.id, 'zh-cn');
    expect(h.versions[0]?.status).toBe('draft');
  });
});
