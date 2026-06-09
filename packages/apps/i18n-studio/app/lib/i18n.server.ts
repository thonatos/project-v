/**
 * Server-side language cookie helpers. Pair with `app/lib/i18n.ts` for the
 * client-safe `Lang` type and validation guard.
 *
 * Cookie persistence mirrors the `theme` cookie:
 *   the `lang` cookie holds the user's UI language. The root loader reads it and
 *   feeds the value into `<html lang>` + `i18n.changeLanguage` so SSR matches the
 *   user's choice and we avoid both a flash of incorrect language and a hydration
 *   mismatch.
 */
import { DEFAULT_LANG, isLang, type Lang } from './i18n';

const COOKIE_NAME = 'lang';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type { Lang } from './i18n';
export { SUPPORTED_LANGS, DEFAULT_LANG, isLang } from './i18n';

export function getLang(request: Request): Lang {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return DEFAULT_LANG;
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rest] = part.split('=');
    const key = rawKey?.trim();
    if (key !== COOKIE_NAME) continue;
    const raw = rest.join('=').trim();
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      /* ignore */
    }
    if (isLang(decoded)) return decoded;
  }
  return DEFAULT_LANG;
}

export function createLangCookie(lang: Lang): string {
  const value = encodeURIComponent(lang);
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}
