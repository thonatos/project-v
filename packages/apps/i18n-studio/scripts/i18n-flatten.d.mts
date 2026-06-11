/**
 * Type declarations for the JS helper so `.ts` consumers (seed script, unit
 * tests) get types when importing `./i18n-flatten.mjs`.
 *
 * Single-namespace model: both helpers operate on the single `studio-ui.json`
 * nested object ↔ studio flat keys (full dotted path, no namespace segment).
 */
export function flatten(obj: Record<string, unknown>, prefix?: string): Record<string, string>;
export function unflatten(flatMap: Record<string, string>): Record<string, unknown>;
