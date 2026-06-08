/**
 * Client-safe theme primitives. Shared between server (`theme.server.ts`,
 * cookie I/O) and client (`Layout` resolves cookie -> className during SSR
 * and during hydration).
 */

export type Theme = 'light' | 'dark' | 'system';

export const THEME_VALUES: readonly Theme[] = ['light', 'dark', 'system'] as const;

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEME_VALUES as readonly string[]).includes(value);
}

/**
 * Resolve a theme to the className applied on `<html>`. `system` becomes the
 * empty string at SSR time; the client overrides it after reading
 * `prefers-color-scheme`.
 */
export function resolveThemeClassName(theme: Theme): '' | 'dark' {
  return theme === 'dark' ? 'dark' : '';
}
