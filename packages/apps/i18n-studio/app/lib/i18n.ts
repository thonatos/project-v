/**
 * Client-safe language primitives. Shared between server (`i18n.server.ts`,
 * cookie I/O) and client (`Layout` resolves cookie -> `<html lang>` and
 * `i18n.changeLanguage` during SSR and hydration).
 *
 * Codes are lowercase BCP-47 tags (`zh-cn` default/fallback, `en-us`), matching
 * the `studio-ui` namespace locale set so self-hosted pull/push align.
 */

export type Lang = 'zh-cn' | 'en-us';

export const SUPPORTED_LANGS: readonly Lang[] = ['zh-cn', 'en-us'] as const;

export const DEFAULT_LANG: Lang = 'zh-cn';

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(value);
}
