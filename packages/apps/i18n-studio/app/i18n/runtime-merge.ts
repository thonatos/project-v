/**
 * Pure helpers for the hydration-time snapshot merge (see `useRuntimeLocalePull`
 * in `root.tsx`). Kept free of the i18next instance and React so they can be
 * unit-tested directly: the effect wires `fetch` + the live instance to these.
 *
 * Single-namespace model: the studio has exactly one i18next namespace,
 * `studio-ui`. The snapshot returns flat keys whose first segments are plain key
 * prefixes (`common.nav.dashboard`), NOT namespaces. We therefore unflatten the
 * whole snapshot into one nested bundle and merge it into the single `studio-ui`
 * namespace — never split by prefix.
 */
import { STUDIO_NAMESPACE } from './config';

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
 * Unflatten a flat snapshot (`{ "common.nav.dashboard": "…" }`) into a single
 * nested bundle (`{ common: { nav: { dashboard: "…" } } }`).
 *
 * Nesting is required: i18next stores resources nested and resolves `t()` along
 * the `.` keySeparator with nested values taking priority — merging a flat
 * dotted-key bundle would NOT override an existing nested value. Keys without a
 * `.` map to a top-level leaf; empty/edge keys are dropped defensively.
 */
export function unflattenSnapshot(flat: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [flatKey, value] of Object.entries(flat)) {
    if (!flatKey || flatKey.startsWith('.') || flatKey.endsWith('.')) continue;
    const segments = flatKey.split('.');
    let cursor = out;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const next = cursor[seg];
      if (next === null || typeof next !== 'object' || Array.isArray(next)) {
        cursor[seg] = {};
      }
      cursor = cursor[seg] as Record<string, unknown>;
    }
    cursor[segments[segments.length - 1]] = value;
  }
  return out;
}

/**
 * Merge a flat snapshot into the single `studio-ui` namespace, but only when at
 * least one resolved value differs from what's already loaded — an identical
 * copy is skipped so no needless re-render (second flicker) is triggered.
 *
 * Diff is checked per flat key via `getResource(lng, STUDIO_NAMESPACE, flatKey)`
 * (i18next resolves the dotted key along the nested tree). When changed, the
 * snapshot is unflattened to nested and deep-merged so existing nested values
 * are actually overridden.
 *
 * Returns true when a merge happened (useful for tests).
 */
export function mergeSnapshot(store: ResourceStore, lng: string, flat: Record<string, unknown>): boolean {
  const changed = Object.entries(flat).some(
    ([flatKey, value]) => store.getResource(lng, STUDIO_NAMESPACE, flatKey) !== value,
  );
  if (!changed) return false;
  store.addResourceBundle(lng, STUDIO_NAMESPACE, unflattenSnapshot(flat), true, true);
  return true;
}
