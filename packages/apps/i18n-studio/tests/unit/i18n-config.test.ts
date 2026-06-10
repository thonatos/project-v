import { describe, it, expect, beforeEach } from 'vitest';

import i18n from '~/i18n/config';
import { DEFAULT_LANG } from '~/lib/i18n';

beforeEach(async () => {
  // Each test pins the language explicitly; reset to default first so order
  // never leaks between cases.
  await i18n.changeLanguage(DEFAULT_LANG);
});

describe('i18n instance', () => {
  it('is initialized with both namespaces and zh-cn fallback', () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.options.fallbackLng).toContain('zh-cn');
    expect(i18n.hasResourceBundle('zh-cn', 'common')).toBe(true);
    expect(i18n.hasResourceBundle('en-us', 'landing')).toBe(true);
  });

  it('returns 中文 copy under zh-cn', async () => {
    await i18n.changeLanguage('zh-cn');
    expect(i18n.t('common:auth.login')).toBe('登录');
    expect(i18n.t('common:auth.logout')).toBe('退出登录');
    expect(i18n.t('landing:hero.enterDashboard')).toBe('进入后台');
  });

  it('returns English copy under en-us', async () => {
    await i18n.changeLanguage('en-us');
    expect(i18n.t('common:auth.login')).toBe('Sign in');
    expect(i18n.t('common:auth.logout')).toBe('Logout');
    expect(i18n.t('landing:hero.enterDashboard')).toBe('Enter Dashboard');
  });

  it('keeps brand/term copy identical across languages', async () => {
    await i18n.changeLanguage('zh-cn');
    const zh = i18n.t('common:nav.dashboard');
    await i18n.changeLanguage('en-us');
    expect(i18n.t('common:nav.dashboard')).toBe(zh);
    expect(zh).toBe('Dashboard');
  });

  it('falls back to zh-cn when a key is missing in en-us', async () => {
    // Inject a key only present in zh-cn, then resolve it under en-us.
    i18n.addResourceBundle('zh-cn', 'common', { onlyZh: '仅中文' }, true, true);
    await i18n.changeLanguage('en-us');
    expect(i18n.t('common:onlyZh')).toBe('仅中文');
  });

  it('returns the key itself for a wholly unknown key', async () => {
    await i18n.changeLanguage('en-us');
    expect(i18n.t('common:does.not.exist')).toBe('does.not.exist');
  });
});

describe('generated locale metadata', () => {
  it('SUPPORTED_LANGS + resources are derived from generated.ts', async () => {
    const gen = await import('~/i18n/generated');
    // i18next 实例的语种集与生成物一致(单一来源)
    expect([...gen.SUPPORTED_LANGS].sort()).toEqual(['en-us', 'zh-cn']);
    expect(gen.DEFAULT_LANG).toBe('zh-cn');
    expect(Object.keys(gen.resources).sort()).toEqual(['en-us', 'zh-cn']);
  });

  it('LOCALE_META carries native display names for the toggle', async () => {
    const gen = await import('~/i18n/generated');
    const codes = gen.LOCALE_META.map((m) => m.code).sort();
    expect(codes).toEqual(['en-us', 'zh-cn']);
    const zh = gen.LOCALE_META.find((m) => m.code === 'zh-cn')!;
    expect(zh.nativeLabel).toBe('中文(简体)');
  });
});
