/**
 * Type declarations for the JS helper so `.ts` consumers (seed script, unit
 * tests) get types when importing `./i18n-flatten.mjs`.
 */
export function flatten(nsMap: Record<string, Record<string, unknown>>): Record<string, string>;
export function unflatten(flatMap: Record<string, string>): Record<string, Record<string, unknown>>;
