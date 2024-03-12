import { cssBundleHref } from '@remix-run/css-bundle';
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from '@remix-run/react';
import { Provider } from 'jotai';
import { ThemeModeScript } from 'flowbite-react';
import { Analytics } from '@vercel/analytics/react';

import { nostrStore } from '~/store/nostr';
import styles from './tailwind.css';

import type { LinksFunction } from '@vercel/remix';

export const links: LinksFunction = () => {
  const defaultLinks = [
    { rel: 'stylesheet', href: styles },
    {
      rel: 'icon',
      href: '//s.implements.io/a/f/favicon.png',
      type: 'image/png',
    },
  ];

  return [...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }, ...defaultLinks] : defaultLinks)];
};

export default function App() {
  return (
    <html lang="en" className="scroll-pt-4">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <ThemeModeScript />
      </head>
      <body>
        <Provider store={nostrStore}>
          <Outlet />
        </Provider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
        <Analytics />
      </body>
    </html>
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
