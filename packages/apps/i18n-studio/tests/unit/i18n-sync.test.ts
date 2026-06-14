import { describe, it, expect } from 'vitest';

import { flatten, unflatten } from '../../scripts/i18n-flatten';

// Single-namespace model: flatten/unflatten convert the single `studio-ui.json`
// nested object ↔ studio flat keys. `common` / `landing` are just the first key
// segments inside the one `studio-ui` namespace — there is no ns prefix to
// strip or add, every `.` is a nesting boundary.

describe('flatten', () => {
  it('flattens a nested object into full dotted paths', () => {
    const content = {
      common: { nav: { dashboard: 'Dashboard' }, auth: { login: 'Sign in' } },
      landing: { hero: { title: 'Hi' } },
    };
    expect(flatten(content)).toEqual({
      'common.nav.dashboard': 'Dashboard',
      'common.auth.login': 'Sign in',
      'landing.hero.title': 'Hi',
    });
  });

  it('handles a top-level leaf key directly', () => {
    expect(flatten({ common: { login: '登录' } })).toEqual({ 'common.login': '登录' });
  });

  it('coerces non-object branch content to nothing', () => {
    // null / array content is skipped rather than throwing
    expect(flatten({ common: null as unknown as Record<string, unknown> })).toEqual({});
  });
});

describe('unflatten', () => {
  it('rebuilds the full nesting from dotted keys', () => {
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

  it('treats every dot as a nesting boundary', () => {
    // "common.hero.title" → nested common.hero.title (no special ns segment)
    expect(unflatten({ 'common.hero.title': 'x' })).toEqual({ common: { hero: { title: 'x' } } });
  });

  it('rebuilds single-segment keys as top-level leaves', () => {
    expect(unflatten({ orphan: 'x', 'common.k': 'y' })).toEqual({ orphan: 'x', common: { k: 'y' } });
  });

  it('skips edge keys with leading/trailing dots', () => {
    expect(unflatten({ '.bad': 'x', 'bad.': 'y', 'common.k': 'z' })).toEqual({ common: { k: 'z' } });
  });
});

describe('flatten ↔ unflatten round-trip', () => {
  it('is lossless for a deeply nested object', () => {
    const content = {
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
    expect(unflatten(flatten(content))).toEqual(content);
  });

  it('round-trips keys with many segments correctly', () => {
    const flat = { 'common.a.b.c.d': 'deep', 'landing.x.y': 'shallow' };
    expect(flatten(unflatten(flat))).toEqual(flat);
  });
});
