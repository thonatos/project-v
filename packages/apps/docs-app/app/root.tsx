import { Link } from 'react-router';
import type { LinksFunction } from 'react-router';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';

import './app.css';

export const links: LinksFunction = () => [
  { rel: 'icon', href: '/favicon.ico', type: 'image/x-icon' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
];

export function meta() {
  return [{ title: 'ρV' }, { name: 'description', content: 'undefined project' }];
}

export default function App() {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0a0f" />
        <Meta />
        <Links />
      </head>
      <body>
        {/* Skip link for accessibility */}
        <a href="#main-content" className="skip-link">
          跳转到主要内容
        </a>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0a0f" />
        <title>出错了 - ρV</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-[var(--color-text)] mb-4">页面出错了</h1>
            <p className="text-[var(--color-text-muted)] mb-8">抱歉，发生了意外错误</p>
            <Link
              to="/"
              className="inline-flex items-center justify-center px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              返回首页
            </Link>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
