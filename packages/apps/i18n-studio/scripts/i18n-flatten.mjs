/**
 * Pure conversion helpers between i18next nested resources and studio's flat
 * key/value model. Shared by `i18n-push.mjs` (flatten) and `i18n-pull.mjs`
 * (unflatten); kept side-effect free so they can be unit tested directly
 * (see `tests/unit/i18n-sync.test.ts`).
 *
 * Mapping convention (see openspec change i18n-studio-react-i18next, 决策 7):
 * - Local resources live at `app/i18n/locales/<lang>/<ns>.json`, where each ns
 *   file is a NESTED object, e.g. `common.json = { nav: { dashboard: "..." } }`.
 *   i18next uses the default `.` keySeparator, so `t('nav.dashboard')` resolves
 *   the nested path — the JSON must stay nested for the app to work.
 * - Studio stores flat keys prefixed by the i18next namespace, e.g.
 *   `common.nav.dashboard`. The full nested path is encoded, not just the ns.
 *
 * `flatten` / `unflatten` are exact inverses for any nested ns map whose leaves
 * are strings and whose keys contain no empty segments.
 */

/**
 * @param {Record<string, unknown>} obj nested object (one namespace's content)
 * @param {string} prefix accumulated dotted prefix (internal recursion arg)
 * @returns {Record<string, string>} flat `{ "a.b.c": value }` for this subtree
 */
function flattenObject(obj, prefix = '') {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(out, flattenObject(val, path));
    } else {
      out[path] = String(val);
    }
  }
  return out;
}

/**
 * Flatten an i18next ns map into studio flat keys prefixed by namespace.
 *
 * @param {Record<string, Record<string, unknown>>} nsMap `{ common: {...}, landing: {...} }`
 * @returns {Record<string, string>} `{ "common.nav.dashboard": "Dashboard", ... }`
 */
export function flatten(nsMap) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [ns, content] of Object.entries(nsMap)) {
    if (content === null || typeof content !== 'object' || Array.isArray(content)) continue;
    Object.assign(out, flattenObject(content, ns));
  }
  return out;
}

/**
 * Restore studio flat keys back into an i18next ns map. The first dotted
 * segment is the namespace; the remainder rebuilds the nested structure. Keys
 * therefore may contain dots (e.g. `common.hero.title` → ns `common`, nested
 * `hero.title`), so we always split on every `.` after the ns prefix.
 *
 * @param {Record<string, string>} flatMap `{ "common.nav.dashboard": "Dashboard", ... }`
 * @returns {Record<string, Record<string, unknown>>} `{ common: { nav: { dashboard: "Dashboard" } } }`
 */
export function unflatten(flatMap) {
  /** @type {Record<string, Record<string, unknown>>} */
  const out = {};
  for (const [flatKey, value] of Object.entries(flatMap)) {
    const sep = flatKey.indexOf('.');
    // No ns prefix → skip (studio always prefixes; defensive against bad data).
    if (sep <= 0 || sep === flatKey.length - 1) continue;
    const ns = flatKey.slice(0, sep);
    const rest = flatKey.slice(sep + 1);
    if (!out[ns]) out[ns] = {};
    const segments = rest.split('.');
    /** @type {Record<string, unknown>} */
    let cursor = out[ns];
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
