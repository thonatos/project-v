/**
 * Pure conversion helpers between the studio-ui namespace's nested resources and
 * studio's flat key/value model. Shared by `i18n-push.mjs` (flatten) and
 * `i18n-pull.mjs` (unflatten); kept side-effect free so they can be unit tested
 * directly (see `tests/unit/i18n-sync.test.ts`).
 *
 * Single-namespace model (see openspec change i18n-studio-single-namespace):
 * - Local resources live at `app/i18n/locales/<lang>/studio-ui.json`, a single
 *   NESTED object, e.g. `{ common: { nav: { dashboard: "..." } }, landing: {…} }`.
 *   i18next uses the default `.` keySeparator, so `t('common.nav.dashboard')`
 *   resolves the nested path — the JSON must stay nested for the app to work.
 * - Studio stores flat keys = the full nested path, e.g. `common.nav.dashboard`.
 *   There is NO namespace prefix to strip/add: `common`/`landing` are just the
 *   first key segments inside the one `studio-ui` namespace.
 *
 * `flatten` / `unflatten` are exact inverses for any nested object whose leaves
 * are strings and whose keys contain no empty segments.
 */

/**
 * Flatten a nested object (the content of one `studio-ui.json`) into studio flat
 * keys. The full dotted path is the studio key — no namespace prefixing.
 *
 * @param {Record<string, unknown>} obj nested object, e.g. `{ common: { nav: { dashboard: "…" } } }`
 * @param {string} prefix accumulated dotted prefix (internal recursion arg)
 * @returns {Record<string, string>} flat `{ "common.nav.dashboard": "…" }`
 */
export function flatten(obj, prefix = '') {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val === null || Array.isArray(val)) {
      // Defensive: skip null / array branches rather than stringifying them —
      // studio resources are nested string leaves, these shouldn't occur.
      continue;
    }
    if (typeof val === 'object') {
      Object.assign(out, flatten(val, path));
    } else {
      out[path] = String(val);
    }
  }
  return out;
}

/**
 * Restore studio flat keys back into the nested object for `studio-ui.json`.
 * Every `.` is a nesting boundary (no namespace segment to peel off), so a key
 * like `common.nav.dashboard` rebuilds `{ common: { nav: { dashboard } } }`.
 *
 * @param {Record<string, string>} flatMap `{ "common.nav.dashboard": "Dashboard", ... }`
 * @returns {Record<string, unknown>} `{ common: { nav: { dashboard: "Dashboard" } } }`
 */
export function unflatten(flatMap) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [flatKey, value] of Object.entries(flatMap)) {
    // Skip empty / edge keys defensively (leading/trailing dot, empty string).
    if (!flatKey || flatKey.startsWith('.') || flatKey.endsWith('.')) continue;
    const segments = flatKey.split('.');
    /** @type {Record<string, unknown>} */
    let cursor = out;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (cursor[seg] === null || typeof cursor[seg] !== 'object' || Array.isArray(cursor[seg])) {
        cursor[seg] = {};
      }
      cursor = /** @type {Record<string, unknown>} */ (cursor[seg]);
    }
    cursor[segments[segments.length - 1]] = value;
  }
  return out;
}
