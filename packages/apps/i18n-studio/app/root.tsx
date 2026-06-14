import * as React from 'react';
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from 'react-router';
import { I18nextProvider } from 'react-i18next';

import { Toaster } from '~/components/ui/sonner';
import { CommandPalette, type CommandNamespace } from '~/components/command-palette';
import { TooltipProvider } from '~/components/ui/tooltip';
import { useSystemThemeSync } from '~/components/theme-toggle';
import { resolveThemeClassName, type Theme } from '~/lib/theme';
import { getTheme } from '~/lib/theme.server';
import { DEFAULT_LANG, type Lang } from '~/lib/i18n';
import { getLang } from '~/lib/i18n.server';
import i18n from '~/i18n/config';
import { mergeSnapshot } from '~/i18n/runtime-merge';
import { getUser } from '~/lib/auth.server';
import { listNamespaces } from '~/lib/services/namespace.server';
import './app.css';

import type { Route } from './+types/root';

export async function loader({ request }: Route.LoaderArgs) {
  const theme = getTheme(request);
  const lang = getLang(request);
  const url = new URL(request.url);
  const slugMatch = url.pathname.match(/^\/dashboard\/([^/]+)/);
  // dashboard 自身列表页(`/dashboard`、`/dashboard/new`、`/dashboard/locales`)不算
  // 进入某个 namespace,排除掉以避免命令面板把它们当成 slug。
  const NON_SLUG = new Set(['new', 'locales']);
  const matchedSlug = slugMatch ? (slugMatch[1] ?? null) : null;
  const currentSlug = matchedSlug && !NON_SLUG.has(matchedSlug) ? matchedSlug : null;

  let user: { id: string; email: string; displayName: string | null; isSuperuser: boolean } | null = null;
  let namespaces: CommandNamespace[] = [];
  try {
    const u = await getUser(request);
    if (u) {
      user = { id: u.id, email: u.email, displayName: u.displayName, isSuperuser: u.isSuperuser };
      namespaces = listNamespaces(u.id).map((n) => ({ id: n.id, slug: n.slug, name: n.name }));
    }
  } catch {
    /* unauthenticated traffic still renders the shell (login/register pages) */
  }

  return { theme, lang, user, namespaces, currentSlug };
}

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: 'i18n-studio' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'theme-color', content: data?.theme === 'dark' ? '#0a0a0a' : '#ffffff' },
  ];
}

interface LayoutData {
  theme: Theme;
  lang: Lang;
  user: { id: string; email: string; displayName: string | null; isSuperuser: boolean } | null;
  namespaces: CommandNamespace[];
  currentSlug: string | null;
}

/**
 * After hydration, pull the latest published copy for the active language from
 * the `studio-ui` snapshot and deep-merge it over the bundled fallback. The
 * snapshot returns flat keys (e.g. `common.nav.dashboard`); we unflatten them
 * into the single `studio-ui` namespace and only merge when a value actually
 * differs, so a 304 / no-op never triggers a second flicker. Failures fall back
 * silently to the bundled resources and never block the first paint.
 */
function useRuntimeLocalePull(lang: Lang): void {
  const etagRef = React.useRef<Record<string, string | null>>({});

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const headers: HeadersInit = {};
    const prevEtag = etagRef.current[lang];
    if (prevEtag) headers['If-None-Match'] = prevEtag;

    void fetch(`/snapshot/studio-ui/${lang}`, { headers })
      .then(async (res) => {
        if (cancelled || res.status === 304 || !res.ok) return;
        etagRef.current[lang] = res.headers.get('ETag');
        const flat = (await res.json()) as Record<string, unknown>;
        // Unflatten the flat `common.nav.dashboard` entries into the single
        // `studio-ui` namespace, merging only when a value actually differs
        // (avoids a second flicker).
        mergeSnapshot(i18n, lang, flat);
      })
      .catch(() => {
        /* silent: bundled resources remain the fallback */
      });

    return () => {
      cancelled = true;
    };
  }, [lang]);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>() as LayoutData | undefined;
  const theme: Theme = data?.theme ?? 'system';
  const lang: Lang = data?.lang ?? DEFAULT_LANG;
  const namespaces = data?.namespaces ?? [];
  const currentSlug = data?.currentSlug ?? null;
  const isSuperuser = data?.user?.isSuperuser ?? false;
  useSystemThemeSync(theme);
  useRuntimeLocalePull(lang);

  // Keep the i18next instance in sync with the loader language. On the server
  // this must happen before render so the streamed HTML matches `<html lang>`;
  // doing it inline here is safe at SSR (single-pass, no client tree to update).
  // On the client we defer to an effect — calling `changeLanguage` during render
  // would trigger a setState in subscribed components mid-render (React warns).
  if (typeof window === 'undefined' && i18n.language !== lang) {
    void i18n.changeLanguage(lang);
  }
  React.useEffect(() => {
    if (i18n.language !== lang) void i18n.changeLanguage(lang);
  }, [lang]);

  return (
    <html lang={lang} className={resolveThemeClassName(theme)}>
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body className="bg-background text-foreground antialiased">
        <I18nextProvider i18n={i18n}>
          <TooltipProvider delayDuration={150}>
            {children}
            <CommandPalette namespaces={namespaces} currentSlug={currentSlug} isSuperuser={isSuperuser} />
          </TooltipProvider>
          <Toaster richColors position="top-right" />
        </I18nextProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = 'Error · i18n-studio';
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = '404 · i18n-studio';
      message = '404';
      details = error.statusText || 'The page you are looking for cannot be found.';
    } else {
      message = `${error.status}`;
      details = error.statusText || (typeof error.data === 'string' ? error.data : details);
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <title>{title}</title>
      <h1 className="text-3xl font-semibold">{message}</h1>
      <p className="max-w-md text-muted-foreground">{details}</p>
      {stack ? (
        <pre className="w-full max-w-2xl overflow-x-auto rounded-md border bg-muted/50 p-4 text-left text-xs">
          <code>{stack}</code>
        </pre>
      ) : null}
    </main>
  );
}
