import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupTestDbFromTemplate, bootstrap, type TestCtx } from '../helpers';

describe('locale dictionary', () => {
  let ctx: TestCtx;
  let locale: typeof import('~/lib/services/locale.server');

  beforeEach(async () => {
    vi.resetModules();
    const env = setupTestDbFromTemplate();
    ctx = await bootstrap(env);
    locale = await import('~/lib/services/locale.server');
  });
  afterEach(() => ctx.env.cleanup());

  describe('built-in seed', () => {
    it('template db 含 12 条内置 enabled locale', () => {
      const all = locale.listLocales();
      expect(all.length).toBe(12);
      expect(all.every((l) => l.isBuiltin && l.enabled)).toBe(true);
      const codes = all.map((l) => l.code);
      expect(codes).toEqual([
        'zh-cn',
        'zh-tw',
        'en-us',
        'en-gb',
        'ja-jp',
        'ko-kr',
        'fr-fr',
        'de-de',
        'es-es',
        'pt-br',
        'ru-ru',
        'ar-sa',
      ]);
    });

    it('sortOrder 严格递增', () => {
      const all = locale.listLocales();
      for (let i = 1; i < all.length; i++) {
        expect(all[i]!.sortOrder).toBeGreaterThan(all[i - 1]!.sortOrder);
      }
    });

    it('listEnabledLocales 返回全部 12 条', () => {
      expect(locale.listEnabledLocales().length).toBe(12);
    });
  });

  describe('CRUD', () => {
    it('createLocale 成功', () => {
      const row = locale.createLocale({
        code: 'vi-vn',
        label: '越南语',
        englishLabel: 'Vietnamese',
      });
      expect(row.code).toBe('vi-vn');
      expect(row.isBuiltin).toBe(false);
      expect(row.enabled).toBe(true);
      expect(row.sortOrder).toBeGreaterThan(110);
    });

    it('createLocale code 重复 → 抛 409', () => {
      expect(() =>
        locale.createLocale({
          code: 'zh-cn',
          label: '简体中文',
          englishLabel: 'Simplified Chinese',
        }),
      ).toThrow();
    });

    it('createLocale code 格式不合法 → 抛 422', () => {
      expect(() => locale.createLocale({ code: 'zh_CN', label: 'X', englishLabel: 'X' })).toThrow();
      expect(() => locale.createLocale({ code: 'EN-US', label: 'X', englishLabel: 'X' })).toThrow();
    });

    it('createLocale label 缺失 → 抛', () => {
      expect(() => locale.createLocale({ code: 'vi-vn', label: '', englishLabel: 'V' })).toThrow();
    });

    it('updateLocale 成功', () => {
      const row = locale.updateLocale('zh-cn', { label: 'X', englishLabel: 'Y' });
      expect(row.label).toBe('X');
      expect(row.englishLabel).toBe('Y');
    });

    it('setEnabled 切换并允许还原', () => {
      const a = locale.setEnabled('ar-sa', false);
      expect(a.enabled).toBe(false);
      const b = locale.setEnabled('ar-sa', true);
      expect(b.enabled).toBe(true);
    });

    it('deleteLocale 非内置成功', () => {
      locale.createLocale({ code: 'vi-vn', label: 'V', englishLabel: 'V' });
      locale.deleteLocale('vi-vn');
      expect(locale.getLocale('vi-vn')).toBeNull();
    });
  });

  describe('protections', () => {
    it('deleteLocale 内置 → 抛 locale_builtin_undeletable', async () => {
      let caught: Response | null = null;
      try {
        locale.deleteLocale('zh-cn');
      } catch (e) {
        if (e instanceof Response) caught = e;
      }
      expect(caught).not.toBeNull();
      const body = (await caught!.json()) as { code?: string };
      expect(body.code).toBe('locale_builtin_undeletable');
    });

    it('deleteLocale 被引用 → 抛 locale_in_use,errors 含引用 namespace', async () => {
      const { auth, namespace } = ctx.api;
      const alice = await auth.registerUser('a@x.com', 'pwd', 'Alice');
      // 先入字典
      locale.createLocale({ code: 'vi-vn', label: 'V', englishLabel: 'V' });
      namespace.createNamespace({ slug: 'biz', name: 'Biz', locales: ['vi-vn'], createdBy: alice.id });

      let caught: Response | null = null;
      try {
        locale.deleteLocale('vi-vn');
      } catch (e) {
        if (e instanceof Response) caught = e;
      }
      expect(caught).not.toBeNull();
      const body = (await caught!.json()) as { code?: string; details?: { namespaces: Array<{ slug: string }> } };
      expect(body.code).toBe('locale_in_use');
      expect(body.details?.namespaces.find((n) => n.slug === 'biz')).toBeTruthy();
    });

    it('setEnabled(false) 被引用 → 抛 locale_in_use', async () => {
      const { auth, namespace } = ctx.api;
      const alice = await auth.registerUser('a@x.com', 'pwd', 'Alice');
      namespace.createNamespace({ slug: 'biz', name: 'Biz', locales: ['de-de'], createdBy: alice.id });
      let caught: Response | null = null;
      try {
        locale.setEnabled('de-de', false);
      } catch (e) {
        if (e instanceof Response) caught = e;
      }
      expect(caught).not.toBeNull();
      const body = (await caught!.json()) as { code?: string };
      expect(body.code).toBe('locale_in_use');
    });

    it('setEnabled(false) 未被引用的内置 locale 成功', () => {
      const r = locale.setEnabled('ar-sa', false);
      expect(r.enabled).toBe(false);
    });
  });

  describe('assertLocalesExist', () => {
    it('全部存在且 enabled → 不抛', () => {
      expect(() => locale.assertLocalesExist(['zh-cn', 'en-us'])).not.toThrow();
    });

    it('含字典外 code → 抛 locale_not_found', async () => {
      let caught: Response | null = null;
      try {
        locale.assertLocalesExist(['zh-cn', 'xx-yy']);
      } catch (e) {
        if (e instanceof Response) caught = e;
      }
      expect(caught).not.toBeNull();
      const body = (await caught!.json()) as { code?: string; details?: { codes: string[] } };
      expect(body.code).toBe('locale_not_found');
      expect(body.details?.codes).toContain('xx-yy');
    });

    it('含 disabled code → 抛 locale_disabled', async () => {
      locale.setEnabled('ar-sa', false);
      let caught: Response | null = null;
      try {
        locale.assertLocalesExist(['ar-sa']);
      } catch (e) {
        if (e instanceof Response) caught = e;
      }
      expect(caught).not.toBeNull();
      const body = (await caught!.json()) as { code?: string; details?: { codes: string[] } };
      expect(body.code).toBe('locale_disabled');
      expect(body.details?.codes).toContain('ar-sa');
    });
  });
});
