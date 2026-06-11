import { describe, it, expect, vi } from 'vitest';

import { unflattenSnapshot, mergeSnapshot, type ResourceStore } from '~/i18n/runtime-merge';
import { STUDIO_NAMESPACE } from '~/i18n/config';

describe('unflattenSnapshot', () => {
  it('unflattens flat dotted keys into one nested bundle', () => {
    const flat = {
      'common.auth.login': 'Sign in',
      'common.nav.dashboard': 'Dashboard',
      'landing.hero.title': 'Hi',
    };
    expect(unflattenSnapshot(flat)).toEqual({
      common: { auth: { login: 'Sign in' }, nav: { dashboard: 'Dashboard' } },
      landing: { hero: { title: 'Hi' } },
    });
  });

  it('treats every dot as a nesting boundary (no ns segment)', () => {
    expect(unflattenSnapshot({ 'common.a.b.c': 'x' })).toEqual({ common: { a: { b: { c: 'x' } } } });
  });

  it('maps a single-segment key to a top-level leaf', () => {
    expect(unflattenSnapshot({ orphan: 'x', 'common.k': 'y' })).toEqual({ orphan: 'x', common: { k: 'y' } });
  });

  it('drops edge keys with leading/trailing dots', () => {
    expect(unflattenSnapshot({ '.bad': 'x', 'bad.': 'y', 'common.k': 'z' })).toEqual({ common: { k: 'z' } });
  });

  it('returns an empty object for an empty snapshot', () => {
    expect(unflattenSnapshot({})).toEqual({});
  });
});

/** A minimal in-memory ResourceStore for asserting merge behavior. */
function fakeStore(seed: Record<string, unknown>): ResourceStore & {
  bundle: Record<string, unknown>;
  addResourceBundle: ReturnType<typeof vi.fn>;
} {
  // Single ns store keyed by `${lng}/studio-ui`, holding a nested object. Diff
  // reads resolve dotted keys along the nested tree (i18next keySeparator).
  const store: Record<string, Record<string, unknown>> = {};
  store[`zh-cn/${STUDIO_NAMESPACE}`] = structuredClone(seed);
  store[`en-us/${STUDIO_NAMESPACE}`] = structuredClone(seed);

  function resolve(obj: Record<string, unknown> | undefined, key: string): unknown {
    if (!obj) return undefined;
    let cursor: unknown = obj;
    for (const seg of key.split('.')) {
      if (cursor === null || typeof cursor !== 'object') return undefined;
      cursor = (cursor as Record<string, unknown>)[seg];
    }
    return cursor;
  }
  function deepMerge(target: Record<string, unknown>, src: Record<string, unknown>): void {
    for (const [k, v] of Object.entries(src)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const next = (target[k] ??= {}) as Record<string, unknown>;
        deepMerge(next, v as Record<string, unknown>);
      } else {
        target[k] = v;
      }
    }
  }
  const addResourceBundle = vi.fn((lng: string, ns: string, resources: Record<string, unknown>) => {
    deepMerge((store[`${lng}/${ns}`] ??= {}), resources);
  });
  return {
    get bundle() {
      return store[`zh-cn/${STUDIO_NAMESPACE}`];
    },
    addResourceBundle,
    getResource(lng: string, ns: string, key: string) {
      return resolve(store[`${lng}/${ns}`], key);
    },
  };
}

describe('mergeSnapshot', () => {
  it('overrides the bundled nested value when the snapshot differs', () => {
    const store = fakeStore({ common: { auth: { login: 'Sign in' } } });
    const merged = mergeSnapshot(store, 'en-us', { 'common.auth.login': 'Log in' });
    expect(merged).toBe(true);
    expect(store.addResourceBundle).toHaveBeenCalledTimes(1);
    expect(store.getResource('en-us', STUDIO_NAMESPACE, 'common.auth.login')).toBe('Log in');
  });

  it('does not merge (no re-render) when every value is identical', () => {
    const store = fakeStore({ common: { auth: { login: 'Sign in' } } });
    const merged = mergeSnapshot(store, 'en-us', { 'common.auth.login': 'Sign in' });
    expect(merged).toBe(false);
    expect(store.addResourceBundle).not.toHaveBeenCalled();
  });

  it('merges when at least one of several keys changed', () => {
    const store = fakeStore({ common: { k: 'same' }, landing: { t: 'old' } });
    const merged = mergeSnapshot(store, 'en-us', { 'common.k': 'same', 'landing.t': 'new' });
    expect(merged).toBe(true);
    expect(store.addResourceBundle).toHaveBeenCalledTimes(1);
    expect(store.addResourceBundle).toHaveBeenCalledWith(
      'en-us',
      STUDIO_NAMESPACE,
      { common: { k: 'same' }, landing: { t: 'new' } },
      true,
      true,
    );
    expect(store.getResource('en-us', STUDIO_NAMESPACE, 'landing.t')).toBe('new');
  });

  it('treats a missing local key as a change (pull fills the gap)', () => {
    const store = fakeStore({ common: {} });
    const merged = mergeSnapshot(store, 'en-us', { 'common.fresh': 'value' });
    expect(merged).toBe(true);
    expect(store.getResource('en-us', STUDIO_NAMESPACE, 'common.fresh')).toBe('value');
  });

  it('an empty snapshot yields no merge and never throws', () => {
    const store = fakeStore({ common: { k: 'v' } });
    expect(() => mergeSnapshot(store, 'en-us', {})).not.toThrow();
    expect(store.addResourceBundle).not.toHaveBeenCalled();
  });
});
