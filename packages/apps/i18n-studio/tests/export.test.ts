import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupTestDb, bootstrap, seedWorld, type TestCtx } from './helpers';

/**
 * 8.11 Export:
 *  - 单 locale 平铺
 *  - 多 locale 顶层分组
 *  - at_version
 *  - 仅 published(draft 不参与)
 */
describe('exportFlat', () => {
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
    // 一个 draft,不应出现在 export 中
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'a.d',
      translations: { 'zh-cn': '草稿AD' },
      asDraft: true,
      actorId: w.alice.id,
    });
    return w;
  }

  it('单 locale:平铺 key->value', async () => {
    const w = await seed();
    const out = ctx.api.exporter.exportFlat({
      namespaceId: w.docs.id,
      locale: ['zh-cn'],
    }) as Record<string, string>;
    expect(out['a.b']).toBe('中AB');
    expect(out['a.c']).toBe('中AC');
    expect(out['a.d']).toBeUndefined(); // draft 不导出
  });

  it('多 locale:顶层 locale -> {key:value}', async () => {
    const w = await seed();
    const out = ctx.api.exporter.exportFlat({
      namespaceId: w.docs.id,
      locale: ['zh-cn', 'en-us'],
    }) as Record<string, Record<string, string>>;
    expect(out['zh-cn']!['a.b']).toBe('中AB');
    expect(out['en-us']!['a.b']).toBe('EN-AB');
    // a.c 没有 en-us
    expect(out['en-us']!['a.c']).toBeUndefined();
  });

  it('at_version:基于 translation_versions 历史快照', async () => {
    const w = await seed();
    const { entry, exporter } = ctx.api;
    // 发布新版本 a.b zh-cn v2
    entry.upsertEntry({
      namespaceId: w.docs.id,
      key: 'a.b',
      translations: { 'zh-cn': '中AB-v2' },
      actorId: w.alice.id,
    });
    const v1 = exporter.exportFlat({
      namespaceId: w.docs.id,
      locale: ['zh-cn'],
      atVersion: 1,
    }) as Record<string, string>;
    expect(v1['a.b']).toBe('中AB');
    const latest = exporter.exportFlat({
      namespaceId: w.docs.id,
      locale: ['zh-cn'],
    }) as Record<string, string>;
    expect(latest['a.b']).toBe('中AB-v2');
  });

  it('未启用 locale → 抛错', async () => {
    const w = await seed();
    expect(() =>
      ctx.api.exporter.exportFlat({
        namespaceId: w.docs.id,
        locale: ['fr-fr'],
      }),
    ).toThrow();
  });

  it('omit locale:默认导出全部 ns 启用的 locale', async () => {
    const w = await seed();
    const out = ctx.api.exporter.exportFlat({
      namespaceId: w.docs.id,
    }) as Record<string, Record<string, string>>;
    expect(Object.keys(out).sort()).toEqual(['en-us', 'zh-cn', 'zh-tw']);
  });
});
