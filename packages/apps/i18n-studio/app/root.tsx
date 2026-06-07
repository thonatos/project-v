import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { Toaster } from '~/components/ui/sonner';

import type { Route } from './+types/root';
import './app.css';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-cn" className="">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Toaster />
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
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : `${error.status}`;
    details = error.statusText || (error.data as string | undefined) || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1 className="text-2xl font-semibold">{message}</h1>
      <p className="text-muted-foreground">{details}</p>
      {stack ? (
        <pre className="w-full overflow-x-auto p-4 text-xs">
          <code>{stack}</code>
        </pre>
      ) : null}
    </main>
  );
}
