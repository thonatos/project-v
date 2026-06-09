/**
 * Pure helpers for the hydration-time snapshot merge (see `useRuntimeLocalePull`
 * in `root.tsx`). Kept free of the i18next instance and React so they can be
 * unit-tested directly: the effect wires `fetch` + the live instance to these.
 */
import { I18N_NAMESPACES } from './config';

/** Minimal slice of the i18next instance the merge step depends on. */
export interface ResourceStore {
  getResource(lng: string, ns: string, key: string): unknown;
  addResourceBundle(
    lng: string,
    ns: string,
    resources: Record<string, unknown>,
    deep?: boolean,
    overwrite?: boolean,
  ): void;
}

/**
 * Split a flat snapshot (`{ "common.login": "…" }`) into per-namespace bundles
 * keyed by the remainder after the first `.` segment. Keys whose prefix is not
 * a known i18next namespace, or that have no `.`, are dropped.
 */
export function splitFlatByNamespace(
  flat: Record<string, unknown>,
  namespaces: readonly string[] = I18N_NAMESPACES,
): Record<string, Record<string, unknown>> {
  const byNs: Record<string, Record<string, unknown>> = {};
  for (const [flatKey, value] of Object.entries(flat)) {
    const dot = flatKey.indexOf('.');
    if (dot <= 0) continue;
    const ns = flatKey.slice(0, dot);
    if (!namespaces.includes(ns)) continue;
    (byNs[ns] ??= {})[flatKey.slice(dot + 1)] = value;
  }
  return byNs;
}

/**
 * Merge per-namespace bundles into the store, but only for namespaces where at
 * least one resolved value differs from what's already loaded — identical copy
 * is skipped so no needless re-render (second flicker) is triggered.
 *
 * Returns the list of namespaces that were actually merged (useful for tests).
 */
export function mergeChangedBundles(
  store: ResourceStore,
  lng: string,
  byNs: Record<string, Record<string, unknown>>,
): string[] {
  const merged: string[] = [];
  for (const [ns, bundle] of Object.entries(byNs)) {
    const changed = Object.entries(bundle).some(([key, value]) => store.getResource(lng, ns, key) !== value);
    if (changed) {
      store.addResourceBundle(lng, ns, bundle, true, true);
      merged.push(ns);
    }
  }
  return merged;
}
