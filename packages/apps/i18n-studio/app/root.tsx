import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from 'react-router';

import { Toaster } from '~/components/ui/sonner';
import { CommandPalette, type CommandNamespace } from '~/components/command-palette';
import { TooltipProvider } from '~/components/ui/tooltip';
import { useSystemThemeSync } from '~/components/theme-toggle';
import { resolveThemeClassName, type Theme } from '~/lib/theme';
import { getTheme } from '~/lib/theme.server';
import { getUser } from '~/lib/auth.server';
import { listNamespaces } from '~/lib/services/namespace.server';
import './app.css';

import type { Route } from './+types/root';

export async function loader({ request }: Route.LoaderArgs) {
  const theme = getTheme(request);
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

  return { theme, user, namespaces, currentSlug };
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
  user: { id: string; email: string; displayName: string | null; isSuperuser: boolean } | null;
  namespaces: CommandNamespace[];
  currentSlug: string | null;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>() as LayoutData | undefined;
  const theme: Theme = data?.theme ?? 'system';
  const namespaces = data?.namespaces ?? [];
  const currentSlug = data?.currentSlug ?? null;
  const isSuperuser = data?.user?.isSuperuser ?? false;
  useSystemThemeSync(theme);

  return (
    <html lang="zh-cn" className={resolveThemeClassName(theme)}>
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body className="bg-background text-foreground antialiased">
        <TooltipProvider delayDuration={150}>
          {children}
          <CommandPalette namespaces={namespaces} currentSlug={currentSlug} isSuperuser={isSuperuser} />
        </TooltipProvider>
        <Toaster richColors position="top-right" />
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
