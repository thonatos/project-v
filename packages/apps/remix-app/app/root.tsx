import clsx from 'clsx';
import React, { useMemo } from 'react';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
} from '@remix-run/react';
import type { LinksFunction, LoaderFunctionArgs } from '@vercel/remix';
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from 'remix-themes';

import { Provider as JotaiProvider } from 'jotai';
import { Toaster } from '~/components/ui/toaster';
import { TooltipProvider } from '~/components/ui/tooltip';
import { LayoutDashboard } from '~/components/custom/layout-dashboard';
import { createProvider, composeProviders } from '~/lib/provider-util';
import { themeSessionResolver } from './sessions.server';

import './tailwind.css';
import './typo.css';

export async function loader({ request }: LoaderFunctionArgs) {
  const { getTheme } = await themeSessionResolver(request);
  return {
    theme: getTheme(),
  };
}

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
];

export const App: React.FC<{}> = () => {
  const data = useLoaderData<typeof loader>();
  const [theme] = useTheme();

  const colorScheme = useMemo(() => {
    return theme === 'dark' ? 'dark' : 'light';
  }, [theme]);

  return (
    <html lang="en" className={clsx(theme)} style={{ colorScheme }}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <PreventFlashOnWrongTheme ssrTheme={Boolean(data.theme)} />
        <Links />
      </head>
      <body>
        <LayoutDashboard>
          <Outlet />
        </LayoutDashboard>
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
};

export default function AppWithProviders() {
  const data = useLoaderData<typeof loader>();

  const providers = [
    createProvider(ThemeProvider, {
      specifiedTheme: data.theme,
      themeAction: '/action/set-theme',
    }),
    createProvider(JotaiProvider),
    createProvider(TooltipProvider),
  ];

  const AllInOneProvider = composeProviders(providers);

  return (
    <AllInOneProvider>
      <App />
    </AllInOneProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error(error);
  return (
    <html>
      <head>
        <title>Oh no!</title>
        <Meta />
        <Links />
      </head>
      <body>
        {/* add the UI you want your users to see */}
        <Scripts />
      </body>
    </html>
  );
}
