/**
 * Type declarations for the JS helper so `.ts` consumers (push/pull scripts,
 * unit tests) get types when importing `./i18n-sync-core.mjs`.
 */
export function diffNewEntries(
  localEntries: Record<string, string>,
  existingKeys: Set<string> | Iterable<string>,
): Record<string, string>;

export function fillPlaceholders(
  systemFlat: Record<string, string>,
  sourceEntries: Record<string, string>,
  lang: string,
  sourceLang: string,
): { merged: Record<string, string>; placeholders: number };
