/**
 * Client-safe language primitives. Shared between server (`i18n.server.ts`,
 * cookie I/O) and client (`Layout` resolves cookie -> `<html lang>` and
 * `i18n.changeLanguage` during SSR and hydration).
 *
 * The supported language set + default are NOT hand-maintained here — they are
 * derived from `app/i18n/generated.ts`, which codegen produces by scanning the
 * committed `app/i18n/locales/` tree. Add a language by adding its locale dir
 * (via `i18n:pull`) and re-running `i18n:codegen`; no edit to this file needed.
 */
import { SUPPORTED_LANGS, DEFAULT_LANG, type Lang } from '~/i18n/generated';

export type { Lang };
export { SUPPORTED_LANGS, DEFAULT_LANG };

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(value);
}
