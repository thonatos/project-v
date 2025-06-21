import clsx from 'clsx';
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { Provider as JotaiProvider, useAtomValue } from 'jotai';
import { base } from 'wagmi/chains';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { createProvider, composeProviders } from '~/lib/provider-util';
import { Toaster } from '~/components/ui/sonner';
import { DefaultLayout } from '~/components/layout';

import { themeAtom } from '~/store/appAtom';

import type { Route } from './+types/root';
import './app.css';

export const links: Route.LinksFunction = () => [
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
  {
    rel: 'icon',
    href: '/favicon.ico',
    size: '48x48',
  },
  {
    rel: 'apple-touch-icon',
    href: '/apple-touch-icon-180x180.png',
  },
  {
    rel: 'manifest',
    href: '/manifest.webmanifest',
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useAtomValue(themeAtom);

  return (
    <html lang="en" className={clsx(theme)} style={{ colorScheme: theme }}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <DefaultLayout>{children}</DefaultLayout>
        <Toaster />
        <ScrollRestoration />
        <Scripts />
        <script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "9da4afd7938f4ddb875cab11b8e56c8e"}'
        ></script>
      </body>
    </html>
  );
}

export default function App() {
  const providers = [
    createProvider(JotaiProvider),
    createProvider(OnchainKitProvider, {
      apiKey: import.meta.env.VITE_PUBLIC_ONCHAINKIT_API_KEY || '',
      chain: base,
    }),
  ];
  const AllInOneProvider = composeProviders(providers);

  return (
    <AllInOneProvider>
      <Outlet />
    </AllInOneProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details = error.status === 404 ? 'The requested page could not be found.' : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
