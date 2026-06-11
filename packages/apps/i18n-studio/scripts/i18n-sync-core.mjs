/**
 * Pure helpers shared by `i18n-push.mjs` and `i18n-pull.mjs` for the
 * source-of-truth workflow. Side-effect free so they can be unit tested
 * directly (see `tests/unit/i18n-sync-core.test.ts`).
 *
 * Model: keys come from source code via `i18next-cli extract` (local source
 * language `zh-cn`). push diffs them against the system; pull fills missing
 * keys with placeholders so the build never lacks a key.
 */

/**
 * Given the local source-language flat entries and the set of flat keys the
 * system already has, return the subset of local entries whose keys are NOT yet
 * in the system — i.e. the keys push should import. Order follows `localEntries`.
 *
 * @param {Record<string, string>} localEntries `{ "<ns>.<path>": value }` from extract
 * @param {Set<string> | Iterable<string>} existingKeys keys already in the system
 * @returns {Record<string, string>} only the new entries
 */
export function diffNewEntries(localEntries, existingKeys) {
  const have = existingKeys instanceof Set ? existingKeys : new Set(existingKeys);
  /** @type {Record<string, string>} */
  const out = {};
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
 * @param {Record<string, string>} systemFlat keys/values pulled from the system
 * @param {Record<string, string>} sourceEntries local source-language entries (key全集)
 * @param {string} lang the locale being filled
 * @param {string} sourceLang the source locale code (e.g. 'zh-cn')
 * @returns {{ merged: Record<string, string>; placeholders: number }}
 */
export function fillPlaceholders(systemFlat, sourceEntries, lang, sourceLang) {
  /** @type {Record<string, string>} */
  const merged = { ...systemFlat };
  let placeholders = 0;
  for (const [k, srcVal] of Object.entries(sourceEntries)) {
    if (!(k in merged)) {
      merged[k] = lang === sourceLang ? srcVal : '';
      placeholders++;
    }
  }
  return { merged, placeholders };
}
