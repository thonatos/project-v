import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { setupTestDbFromTemplate, bootstrap, seedWorld, type TestCtx } from '../helpers';

describe('locale repair script', () => {
  let ctx: TestCtx;
  let repair: typeof import('~/scripts/repair-locales');
  let locale: typeof import('~/lib/services/locale.server');

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDbFromTemplate();
    ctx = await bootstrap(env);
    repair = await import('~/scripts/repair-locales');
    locale = await import('~/lib/services/locale.server');
  });
  afterEach(() => ctx.env.cleanup());

  it('无遗留 code 时 ok=true,missing 空', async () => {
    await seedWorld(ctx);
    const r = repair.repairLocales();
    expect(r.ok).toBe(true);
    expect(Object.keys(r.missing)).toEqual([]);
  });

  it('默认模式发现遗留 code 时 ok=false,db 不变', async () => {
    const w = await seedWorld(ctx);
    // 注入字典外 code,绕过 service
    const d = ctx.api.db.getDb();
    d.update(ctx.api.schema.namespaces)
      .set({ locales: JSON.stringify(['zh-cn', 'xx-yy']) })
      .where(eq(ctx.api.schema.namespaces.id, w.docs.id))
      .run();

    const before = locale.listLocales().length;
    const r = repair.repairLocales();
    expect(r.ok).toBe(false);
    expect(r.missing['xx-yy']).toContain('docs');
    expect(r.added).toEqual([]);
    // 字典未修改
    expect(locale.listLocales().length).toBe(before);
  });

  it('--auto-add 模式入字典后再跑无 missing', async () => {
    const w = await seedWorld(ctx);
    const d = ctx.api.db.getDb();
    d.update(ctx.api.schema.namespaces)
      .set({ locales: JSON.stringify(['zh-cn', 'xx-yy']) })
      .where(eq(ctx.api.schema.namespaces.id, w.docs.id))
      .run();

    const r = repair.repairLocales({ autoAdd: true });
    expect(r.ok).toBe(true);
    expect(r.added).toContain('xx-yy');
    const added = locale.getLocale('xx-yy');
    expect(added?.isBuiltin).toBe(false);
    expect(added?.enabled).toBe(true);

    // 第二次应当 no-op
    const r2 = repair.repairLocales();
    expect(r2.ok).toBe(true);
    expect(Object.keys(r2.missing)).toEqual([]);
  });

  it('autoAdd 后 namespace.updateNamespace 不再因字典外 code 报错', async () => {
    const w = await seedWorld(ctx);
    const d = ctx.api.db.getDb();
    d.update(ctx.api.schema.namespaces)
      .set({ locales: JSON.stringify(['zh-cn', 'xx-yy']) })
      .where(eq(ctx.api.schema.namespaces.id, w.docs.id))
      .run();

    repair.repairLocales({ autoAdd: true });
    expect(() =>
      ctx.api.namespace.updateNamespace('docs', { locales: ['zh-cn', 'xx-yy'], defaultLocale: 'zh-cn' }),
    ).not.toThrow();
  });
});
