import { describe, it, expect } from 'vitest';

import { getLang, createLangCookie, DEFAULT_LANG } from '~/lib/i18n.server';

function mkReq(cookie?: string): Request {
  return new Request('http://localhost/', cookie ? { headers: { Cookie: cookie } } : undefined);
}

describe('getLang', () => {
  it('回退 DEFAULT_LANG when no Cookie header', () => {
    expect(getLang(mkReq())).toBe(DEFAULT_LANG);
    expect(DEFAULT_LANG).toBe('zh-cn');
  });

  it('回退 DEFAULT_LANG when cookie header present but no lang key', () => {
    expect(getLang(mkReq('theme=dark; foo=bar'))).toBe('zh-cn');
  });

  it('reads a valid lang cookie', () => {
    expect(getLang(mkReq('lang=en-us'))).toBe('en-us');
    expect(getLang(mkReq('lang=zh-cn'))).toBe('zh-cn');
  });

  it('reads lang among other cookies', () => {
    expect(getLang(mkReq('theme=dark; lang=en-us; session=abc'))).toBe('en-us');
  });

  it('reads a URL-encoded value', () => {
    expect(getLang(mkReq(`lang=${encodeURIComponent('en-us')}`))).toBe('en-us');
  });

  it('回退 zh-cn for an unsupported value (fr-fr)', () => {
    expect(getLang(mkReq('lang=fr-fr'))).toBe('zh-cn');
  });

  it.each([['EN-US'], ['en'], ['zh_CN'], [''], ['english']])('回退 zh-cn for invalid value %s', (v) => {
    expect(getLang(mkReq(`lang=${v}`))).toBe('zh-cn');
  });

  it('回退 zh-cn on a malformed percent-encoding (decode failure)', () => {
    // `%E0%A4%A` is an incomplete escape sequence — decodeURIComponent throws,
    // and the raw value is not a valid lang either, so we fall back.
    expect(getLang(mkReq('lang=%E0%A4%A'))).toBe('zh-cn');
  });
});

describe('createLangCookie', () => {
  it('emits Path, Max-Age (one year) and SameSite=Lax', () => {
    const cookie = createLangCookie('en-us');
    expect(cookie).toContain('lang=en-us');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain(`Max-Age=${60 * 60 * 24 * 365}`);
    expect(cookie).toContain('SameSite=Lax');
  });

  it('URL-encodes the value', () => {
    expect(createLangCookie('zh-cn')).toContain(`lang=${encodeURIComponent('zh-cn')}`);
  });

  it('round-trips through getLang', () => {
    const cookie = createLangCookie('en-us');
    const value = cookie.split(';')[0]!; // "lang=en-us"
    expect(getLang(mkReq(value))).toBe('en-us');
  });
});
