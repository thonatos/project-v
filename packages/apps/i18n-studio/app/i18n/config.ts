/**
 * Single shared i18next instance. Imported by both `entry.server.tsx` and
 * `entry.client.tsx` so SSR and hydration run against the exact same instance +
 * resources; the active language is driven solely by the root loader's `lang`
 * value (see `root.tsx`), never by browser detection — that keeps SSR (cookie)
 * and CSR consistent and avoids hydration mismatch.
 *
 * Resources + the supported language set come from `generated.ts` (produced by
 * `i18n:codegen` scanning `app/i18n/locales/`), not hand-written here. They are
 * statically imported and bundled (no async backend / code split), so the first
 * frame already has the correct copy with no FOUC.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LANG, SUPPORTED_LANGS, I18N_NAMESPACES, resources } from './generated';

export { I18N_NAMESPACES, resources };

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANG,
    fallbackLng: DEFAULT_LANG,
    supportedLngs: SUPPORTED_LANGS as readonly string[] as string[],
    // Our locale codes carry a lowercase region (`zh-cn`, `en-us`) to match the
    // studio DB. i18next otherwise normalizes the region to uppercase (`zh-CN`)
    // for lookups, which would miss our lowercase-keyed bundles and make `t()`
    // return raw keys. `lowerCaseLng` forces lookup codes lowercase so they line
    // up with the resource keys.
    lowerCaseLng: true,
    defaultNS: 'common',
    ns: I18N_NAMESPACES as readonly string[] as string[],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    // Synchronous init: resources are bundled, so the translator must be ready
    // on the first (SSR) render — not a tick later — or `t()` returns raw keys.
    // (i18next v26 renamed the old `initImmediate` to `initAsync`; `false` = sync.)
    initAsync: false,
  });
}

export default i18n;
