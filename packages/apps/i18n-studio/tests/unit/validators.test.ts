import { describe, it, expect } from 'vitest';

import { localeSchema, flatKeySchema, parseEntries, parseNsLocales } from '~/lib/validators';

describe('localeSchema', () => {
  it.each([['zh-cn'], ['en-us'], ['ja-jp'], ['zh'], ['pt-br']])('accepts %s', (v) => {
    expect(localeSchema.safeParse(v).success).toBe(true);
  });
  it.each([['Chinese'], ['zh_CN'], ['ZH-CN'], [''], ['zh-CN'], ['z']])('rejects %s', (v) => {
    expect(localeSchema.safeParse(v).success).toBe(false);
  });
});

describe('flatKeySchema', () => {
  it.each([['home.title'], ['home_subtitle'], ['user.profile.name'], ['a-b.c_d-e'], ['a']])('accepts %s', (v) => {
    expect(flatKeySchema.safeParse(v).success).toBe(true);
  });
  it.each([[''], ['.home'], ['home.'], ['home..title'], ['home title'], ['home/title'], ['中文']])(
    'rejects %s',
    (v) => {
      expect(flatKeySchema.safeParse(v).success).toBe(false);
    },
  );
});

describe('parseEntries', () => {
  it('returns ok for valid input', () => {
    const r = parseEntries({ 'home.title': '首页', 'home.cta': 'Get started' });
    expect(r.ok).toBe(true);
    expect(r.entries).toHaveLength(2);
  });
  it('reports illegal keys', () => {
    const r = parseEntries({ 'home..title': 'x', 'good.key': 'y' });
    expect(r.ok).toBe(false);
    expect(r.errors[0]?.key).toBe('home..title');
  });
  it('rejects non-string values', () => {
    const r = parseEntries({ 'a.b': 123 });
    expect(r.ok).toBe(false);
  });
  it('rejects non-object input', () => {
    const r = parseEntries('not-an-object');
    expect(r.ok).toBe(false);
  });
});

describe('parseNsLocales', () => {
  it('parses a valid JSON string array', () => {
    expect(parseNsLocales('["zh-cn","en-us"]')).toEqual(['zh-cn', 'en-us']);
  });
  it('returns [] for invalid JSON', () => {
    expect(parseNsLocales('not json')).toEqual([]);
  });
  it('returns [] for non-array JSON', () => {
    expect(parseNsLocales('{"a":1}')).toEqual([]);
  });
  it('drops non-string elements', () => {
    expect(parseNsLocales('["zh-cn",1,null,"en-us"]')).toEqual(['zh-cn', 'en-us']);
  });
  it('handles empty array', () => {
    expect(parseNsLocales('[]')).toEqual([]);
  });
});
