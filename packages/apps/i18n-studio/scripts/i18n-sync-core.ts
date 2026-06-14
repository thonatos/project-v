/**
 * Pure helpers shared by `i18n-push.ts` and `i18n-pull.ts` for the
 * source-of-truth workflow. Side-effect free so they can be unit tested
 * directly (see `tests/unit/i18n-sync-core.test.ts`).
 *
 * Model: keys come from source code via `i18next-cli extract` (local source
 * language `zh-cn`). push diffs them against the system; pull fills missing
 * keys with placeholders so the build never lacks a key.
 */

interface FillResult {
  merged: Record<string, string>;
  placeholders: number;
}

/**
 * Given the local source-language flat entries and the set of flat keys the
 * system already has, return the subset of local entries whose keys are NOT yet
 * in the system — i.e. the keys push should import. Order follows `localEntries`.
 *
 * @param localEntries `{ "<ns>.<path>": value }` from extract
 * @param existingKeys keys already in the system
 * @returns only the new entries
 */
export function diffNewEntries(
  localEntries: Record<string, string>,
  existingKeys: Set<string> | Iterable<string>,
): Record<string, string> {
  const have = existingKeys instanceof Set ? existingKeys : new Set(existingKeys);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(localEntries)) {
    if (!have.has(k)) out[k] = v;
  }
  return out;
}

/**
 * Augment a system-provided flat map for one locale with placeholders for any
 * "should-exist" source key it lacks. The source language keeps its local
 * source text as the placeholder (so un-pushed entries aren't blanked); every
 * other locale gets an empty string. Existing system values are never
 * overwritten. Returns a NEW object; inputs are not mutated.
 *
 * @param systemFlat keys/values pulled from the system
 * @param sourceEntries local source-language entries (key 全集)
 * @param lang the locale being filled
 * @param sourceLang the source locale code (e.g. 'zh-cn')
 */
export function fillPlaceholders(
  systemFlat: Record<string, string>,
  sourceEntries: Record<string, string>,
  lang: string,
  sourceLang: string,
): FillResult {
  const merged: Record<string, string> = { ...systemFlat };
  let placeholders = 0;
  for (const [k, srcVal] of Object.entries(sourceEntries)) {
    if (!(k in merged)) {
      merged[k] = lang === sourceLang ? srcVal : '';
      placeholders++;
    }
  }
  return { merged, placeholders };
}
