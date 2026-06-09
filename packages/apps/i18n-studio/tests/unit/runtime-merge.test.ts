import { describe, it, expect, vi } from 'vitest';

import { splitFlatByNamespace, mergeChangedBundles, type ResourceStore } from '~/i18n/runtime-merge';

const NS = ['common', 'landing'] as const;

describe('splitFlatByNamespace', () => {
  it('splits flat keys into per-namespace nested bundles by first segment', () => {
    const flat = {
      'common.auth.login': 'Sign in',
      'common.nav.dashboard': 'Dashboard',
      'landing.hero.title': 'Hi',
    };
    expect(splitFlatByNamespace(flat, NS)).toEqual({
      common: { 'auth.login': 'Sign in', 'nav.dashboard': 'Dashboard' },
      landing: { 'hero.title': 'Hi' },
    });
  });

  it('drops keys whose prefix is not a known namespace', () => {
    expect(splitFlatByNamespace({ 'unknown.k': 'x', 'common.k': 'y' }, NS)).toEqual({
      common: { k: 'y' },
    });
  });

  it('drops keys without a dot separator', () => {
    expect(splitFlatByNamespace({ orphan: 'x', 'common.k': 'y' }, NS)).toEqual({
      common: { k: 'y' },
    });
  });

  it('returns empty object for an empty snapshot', () => {
    expect(splitFlatByNamespace({}, NS)).toEqual({});
  });
});

/** A minimal in-memory ResourceStore for asserting merge behavior. */
function fakeStore(seed: Record<string, Record<string, unknown>>): ResourceStore & {
  bundles: Record<string, Record<string, unknown>>;
  addResourceBundle: ReturnType<typeof vi.fn>;
} {
  const bundles: Record<string, Record<string, unknown>> = structuredClone(seed);
  const addResourceBundle = vi.fn((lng: string, ns: string, resources: Record<string, unknown>) => {
    const key = `${lng}/${ns}`;
    bundles[key] = { ...bundles[key], ...resources };
  });
  return {
    bundles,
    addResourceBundle,
    getResource(lng: string, ns: string, key: string) {
      return bundles[`${lng}/${ns}`]?.[key];
    },
  };
}

describe('mergeChangedBundles', () => {
  it('overrides the bundled fallback when the snapshot value differs', () => {
    const store = fakeStore({ 'en-us/common': { 'auth.login': 'Sign in' } });
    const merged = mergeChangedBundles(store, 'en-us', { common: { 'auth.login': 'Log in' } });
    expect(merged).toEqual(['common']);
    expect(store.addResourceBundle).toHaveBeenCalledTimes(1);
    expect(store.getResource('en-us', 'common', 'auth.login')).toBe('Log in');
  });

  it('does not merge (no re-render) when every value is identical', () => {
    const store = fakeStore({ 'en-us/common': { 'auth.login': 'Sign in' } });
    const merged = mergeChangedBundles(store, 'en-us', { common: { 'auth.login': 'Sign in' } });
    expect(merged).toEqual([]);
    expect(store.addResourceBundle).not.toHaveBeenCalled();
  });

  it('merges only the namespaces that changed', () => {
    const store = fakeStore({
      'en-us/common': { k: 'same' },
      'en-us/landing': { t: 'old' },
    });
    const merged = mergeChangedBundles(store, 'en-us', {
      common: { k: 'same' },
      landing: { t: 'new' },
    });
    expect(merged).toEqual(['landing']);
    expect(store.addResourceBundle).toHaveBeenCalledTimes(1);
    expect(store.addResourceBundle).toHaveBeenCalledWith('en-us', 'landing', { t: 'new' }, true, true);
  });

  it('treats a missing local key as a change (pull fills the gap)', () => {
    const store = fakeStore({ 'en-us/common': {} });
    const merged = mergeChangedBundles(store, 'en-us', { common: { fresh: 'value' } });
    expect(merged).toEqual(['common']);
    expect(store.getResource('en-us', 'common', 'fresh')).toBe('value');
  });
});

describe('split + merge pipeline (304 / failure paths handled by caller)', () => {
  it('an empty split yields no merges and never throws', () => {
    const store = fakeStore({ 'en-us/common': { k: 'v' } });
    expect(() => mergeChangedBundles(store, 'en-us', splitFlatByNamespace({}, NS))).not.toThrow();
    expect(store.addResourceBundle).not.toHaveBeenCalled();
  });
});
