import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupTestDb, bootstrap, seedWorld, type TestCtx } from './helpers';

/**
 * 8.10 查询视图:
 *  - view=all / locale 子集
 *  - at_version 快照(基于 translation_versions.version)
 *  - group=key vs group=locale 一致性
 *  - include=draft / both
 *  - status=draft 仅返回有 draft 的 entry
 *  - 分页 cursor
 */
describe('query views', () => {
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
    // 3 entries:
    //  - a.b: zh published v1, en published v1
    //  - a.c: zh published v1, en draft v1
    //  - x.y: zh published v1, en published v1
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
      namespaceId: w.docs.id,
      key: 'a.c',
      translations: { 'en-us': 'EN-AC-d' },
      asDraft: true,
      actorId: w.alice.id,
    });
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'x.y',
      translations: { 'zh-cn': '中XY', 'en-us': 'EN-XY' },
      actorId: w.alice.id,
    });
    return w;
  }

  it('view=all:返回每个 entry 的全部 locale', async () => {
    const w = await seed();
    const r = ctx.api.query.listEntries(w.docs.id, { view: 'all' });
    expect(r.entries).toBeDefined();
    expect(r.entries!.length).toBe(3);
    const ab = r.entries!.find((e) => e.key === 'a.b')!;
    expect(Object.keys(ab.translations).sort()).toEqual(['en-us', 'zh-cn', 'zh-tw']);
  });

  it('locale 子集:仅返回 zh-cn / en-us', async () => {
    const w = await seed();
    const r = ctx.api.query.listEntries(w.docs.id, { locale: ['zh-cn', 'en-us'] });
    const ab = r.entries!.find((e) => e.key === 'a.b')!;
    expect(Object.keys(ab.translations).sort()).toEqual(['en-us', 'zh-cn']);
  });

  it('group=locale:按 locale 桶组织;与 group=key 在 published 集合上一致', async () => {
    const w = await seed();
    const byKey = ctx.api.query.listEntries(w.docs.id, { locale: ['zh-cn'], group: 'key' });
    const byLocale = ctx.api.query.listEntries(w.docs.id, { locale: ['zh-cn'], group: 'locale' });
    const fromKey: Record<string, string> = {};
    for (const e of byKey.entries!) {
      const cell = e.translations['zh-cn'];
      if (cell && !cell.missing) fromKey[e.key] = cell.value;
    }
    const fromLocale: Record<string, string> = {};
    for (const item of byLocale.locales!['zh-cn']!) {
      if (!item.missing) fromLocale[item.key] = item.value;
    }
    expect(fromKey).toEqual(fromLocale);
  });

  it('include=both:有 draft 时同时给 published 和 draft', async () => {
    const w = await seed();
    const r = ctx.api.query.listEntries(w.docs.id, { view: 'all', include: 'both' });
    const ac = r.entries!.find((e) => e.key === 'a.c')!;
    // en-us:无 published 但有 draft → 不标 missing(missing = !draft = false)
    expect(ac.translations['en-us']?.missing).toBeFalsy();
    expect(ac.translations['en-us']?.version).toBeNull();
    expect(ac.translations['en-us']?.draft?.value).toBe('EN-AC-d');
    // zh-cn:有 published,无 draft
    expect(ac.translations['zh-cn']?.value).toBe('中AC');
    expect(ac.translations['zh-cn']?.draft).toBeUndefined();
  });

  it('status=draft:仅返回包含任意 draft 的 entry', async () => {
    const w = await seed();
    const r = ctx.api.query.listEntries(w.docs.id, { view: 'all', include: 'both', status: 'draft' });
    expect(r.entries!.map((e) => e.key)).toEqual(['a.c']);
  });

  it('include=draft:返回的 cell 取自 draft;无 draft 标 missing', async () => {
    const w = await seed();
    const r = ctx.api.query.listEntries(w.docs.id, { view: 'all', include: 'draft' });
    const ac = r.entries!.find((e) => e.key === 'a.c')!;
    expect(ac.translations['en-us']?.value).toBe('EN-AC-d');
    // a.b 没有 draft → missing
    const ab = r.entries!.find((e) => e.key === 'a.b')!;
    expect(ab.translations['en-us']?.missing).toBe(true);
  });

  it('at_version 快照:返回某 version 之前的 published', async () => {
    const w = await seed();
    const { entry, query } = ctx.api;
    // 再发布一次 a.b zh-cn,使其有 v2
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'a.b',
      translations: { 'zh-cn': '中AB-v2' },
      actorId: w.alice.id,
    });
    // atVersion=1 应回退到 v1
    const r = query.listEntries(w.docs.id, { view: 'all', atVersion: 1 });
    const ab = r.entries!.find((e) => e.key === 'a.b')!;
    expect(ab.translations['zh-cn']?.value).toBe('中AB');
    expect(ab.translations['zh-cn']?.version).toBe(1);
  });

  it('分页 cursor:pageSize 受限,nextCursor 可继续', async () => {
    const w = await seed();
    const r1 = ctx.api.query.listEntries(w.docs.id, { view: 'all', pageSize: 2 });
    expect(r1.entries!.length).toBe(2);
    expect(r1.page.nextCursor).not.toBeNull();
    const r2 = ctx.api.query.listEntries(w.docs.id, {
      view: 'all',
      pageSize: 2,
      cursor: r1.page.nextCursor,
    });
    expect(r2.entries!.length).toBe(1);
    expect(r2.page.nextCursor).toBeNull();
  });

  it('view=all 与 locale 互斥:同时给 → 报错', async () => {
    const w = await seed();
    expect(() => ctx.api.query.listEntries(w.docs.id, { view: 'all', locale: ['zh-cn'] })).toThrow();
  });
});
