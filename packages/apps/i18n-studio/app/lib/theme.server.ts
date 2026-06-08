/**
 * Server-side theme cookie helpers. Pair with `app/lib/theme.ts` for the
 * client-safe `Theme` type and the resolve helper.
 *
 * Cookie persistence:
 *   `theme` cookie holds the user's preference. The root loader reads it and
 *   feeds the value into `<html className>` so SSR matches the user's choice
 *   and we avoid a flash of incorrect theme.
 *
 * `system` defers to the OS preference; the server cannot know that value, so
 * SSR falls back to `light` and the client syncs after hydration.
 */
import { isTheme, type Theme } from './theme';

const COOKIE_NAME = 'theme';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type { Theme } from './theme';
export { THEME_VALUES, isTheme, resolveThemeClassName } from './theme';

export function getTheme(request: Request): Theme {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return 'system';
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
    if (isTheme(decoded)) return decoded;
  }
  return 'system';
}

export function createThemeCookie(theme: Theme): string {
  const value = encodeURIComponent(theme);
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}
