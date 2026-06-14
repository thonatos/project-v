import { describe, it, expect } from 'vitest';

import { diffNewEntries, fillPlaceholders } from '../../app/lib/i18n-sync/workflow';

describe('diffNewEntries (push diff)', () => {
  const local = {
    'common.auth.login': '登录',
    'common.auth.register': '注册',
    'landing.hero.title': '标题',
  };

  it('returns only keys the system does not already have', () => {
    const existing = new Set(['common.auth.login']);
    expect(diffNewEntries(local, existing)).toEqual({
      'common.auth.register': '注册',
      'landing.hero.title': '标题',
    });
  });

  it('returns everything when the system is empty (first push)', () => {
    expect(diffNewEntries(local, new Set())).toEqual(local);
  });

  it('returns nothing when the system already has every key', () => {
    const existing = new Set(Object.keys(local));
    expect(diffNewEntries(local, existing)).toEqual({});
  });

  it('never includes existing keys, so human translations are not overwritten', () => {
    // System already translated hero.title; push must not re-send it.
    const existing = new Set(['landing.hero.title']);
    const out = diffNewEntries(local, existing);
    expect(out).not.toHaveProperty('landing.hero.title');
  });

  it('accepts a plain iterable of keys, not just a Set', () => {
    expect(diffNewEntries(local, ['common.auth.login', 'common.auth.register'])).toEqual({
      'landing.hero.title': '标题',
    });
  });
});

describe('fillPlaceholders (pull placeholder fill)', () => {
  const source = {
    'common.auth.login': '登录',
    'common.auth.register': '注册',
    'common.auth.email': '邮箱',
  };

  it('keeps system values and fills missing keys with empty string for secondary langs', () => {
    const system = { 'common.auth.login': 'Sign in' };
    const { merged, placeholders } = fillPlaceholders(system, source, 'en-us', 'zh-cn');
    expect(merged).toEqual({
      'common.auth.login': 'Sign in',
      'common.auth.register': '',
      'common.auth.email': '',
    });
    expect(placeholders).toBe(2);
  });

  it('uses local source text as placeholder for the source language itself', () => {
    // zh-cn system is missing register/email (not yet pushed) → fall back to local source.
    const system = { 'common.auth.login': '登录' };
    const { merged, placeholders } = fillPlaceholders(system, source, 'zh-cn', 'zh-cn');
    expect(merged).toEqual(source);
    expect(placeholders).toBe(2);
  });

  it('adds nothing when the system already has every source key', () => {
    const system = { ...source };
    const { merged, placeholders } = fillPlaceholders(system, source, 'en-us', 'zh-cn');
    expect(merged).toEqual(system);
    expect(placeholders).toBe(0);
  });

  it('does not mutate the input system map', () => {
    const system = { 'common.auth.login': 'Sign in' };
    const snapshot = { ...system };
    fillPlaceholders(system, source, 'en-us', 'zh-cn');
    expect(system).toEqual(snapshot);
  });

  it('never overwrites an existing (translated) system value with a placeholder', () => {
    const system = { 'common.auth.login': 'Sign in', 'common.auth.register': 'Sign up' };
    const { merged } = fillPlaceholders(system, source, 'en-us', 'zh-cn');
    expect(merged['common.auth.login']).toBe('Sign in');
    expect(merged['common.auth.register']).toBe('Sign up');
    expect(merged['common.auth.email']).toBe('');
  });
});
