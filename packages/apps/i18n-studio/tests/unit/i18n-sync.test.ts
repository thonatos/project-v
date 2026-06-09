import { describe, it, expect } from 'vitest';

import { flatten, unflatten } from '../../scripts/i18n-flatten.mjs';

describe('flatten', () => {
  it('prefixes nested keys with the i18next namespace', () => {
    const nsMap = {
      common: { nav: { dashboard: 'Dashboard' }, auth: { login: 'Sign in' } },
      landing: { hero: { title: 'Hi' } },
    };
    expect(flatten(nsMap)).toEqual({
      'common.nav.dashboard': 'Dashboard',
      'common.auth.login': 'Sign in',
      'landing.hero.title': 'Hi',
    });
  });

  it('handles top-level leaf keys directly under a namespace', () => {
    expect(flatten({ common: { login: '登录' } })).toEqual({ 'common.login': '登录' });
  });

  it('coerces non-object namespace content to nothing', () => {
    // null / array content is skipped rather than throwing
    expect(flatten({ common: null as unknown as Record<string, unknown> })).toEqual({});
  });
});

describe('unflatten', () => {
  it('splits the first segment as ns and rebuilds nesting', () => {
    const flat = {
      'common.nav.dashboard': 'Dashboard',
      'common.auth.login': 'Sign in',
      'landing.hero.title': 'Hi',
    };
    expect(unflatten(flat)).toEqual({
      common: { nav: { dashboard: 'Dashboard' }, auth: { login: 'Sign in' } },
      landing: { hero: { title: 'Hi' } },
    });
  });

  it('keeps deep dotted keys (ns = first segment only)', () => {
    // "common.hero.title" → ns=common, nested hero.title
    expect(unflatten({ 'common.hero.title': 'x' })).toEqual({ common: { hero: { title: 'x' } } });
  });

  it('skips keys without an ns prefix', () => {
    expect(unflatten({ orphan: 'x', 'common.k': 'y' })).toEqual({ common: { k: 'y' } });
  });
});

describe('flatten ↔ unflatten round-trip', () => {
  it('is lossless for nested namespaces', () => {
    const nsMap = {
      common: {
        nav: { dashboard: 'Dashboard', settings: 'Settings' },
        auth: { login: 'Sign in', logout: 'Logout' },
        lang: { zh: '中文', en: 'English' },
      },
      landing: {
        hero: { title: 'Title', subtitle: 'Sub' },
        features: { heading: 'Features' },
      },
    };
    expect(unflatten(flatten(nsMap))).toEqual(nsMap);
  });

  it('round-trips keys containing dots correctly', () => {
    const flat = { 'common.a.b.c.d': 'deep', 'landing.x.y': 'shallow' };
    expect(flatten(unflatten(flat))).toEqual(flat);
  });
});
