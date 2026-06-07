import { Form, Link, NavLink, Outlet, useLoaderData } from 'react-router';

import { requireRole } from '~/lib/auth.server';
import { getNamespaceStats, getNamespaceLocales } from '~/lib/services/namespace.server';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

import type { Route } from './+types/ns.$slug';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
  const stats = getNamespaceStats(ctx.namespace.id);
  return {
    namespace: ctx.namespace,
    role: ctx.role,
    user: ctx.user,
    stats,
    locales: getNamespaceLocales(ctx.namespace),
  };
}

export default function NamespaceLayout() {
  const { namespace, role, user, stats, locales } = useLoaderData<typeof loader>();
  const navItems = [
    { to: '.', label: 'Overview', end: true },
    { to: 'entries', label: 'Entries' },
    { to: 'tasks', label: 'Tasks' },
    { to: 'sync', label: 'Sync' },
  ];
  if (role === 'admin') {
    navItems.push({ to: 'members', label: 'Members' });
    navItems.push({ to: 'settings', label: 'Settings' });
  }
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-semibold">
              i18n-studio
            </Link>
            <span className="text-muted-foreground">/</span>
            <span>{namespace.slug}</span>
            <span className="text-xs text-muted-foreground">bv:{namespace.bundleVersion}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{user.email}</span>
            <Form method="post" action="/logout">
              <Button type="submit" variant="ghost" size="sm">
                Logout
              </Button>
            </Form>
          </div>
        </div>
      </header>
      <div className="container mx-auto flex flex-1 gap-6 p-4">
        <aside className="w-44 shrink-0">
          <nav className="flex flex-col gap-1 text-sm">
            {navItems.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) =>
                  cn('rounded-md px-3 py-1.5', isActive ? 'bg-secondary text-secondary-foreground' : 'hover:bg-accent')
                }
              >
                {it.label}
              </NavLink>
            ))}
            {stats.draftCount > 0 ? (
              <span className="px-3 text-xs text-muted-foreground">drafts: {stats.draftCount}</span>
            ) : null}
          </nav>
        </aside>
        <main className="flex-1">
          <Outlet context={{ namespace, role, user, locales, stats }} />
        </main>
      </div>
    </div>
  );
}

export type NsContext = {
  namespace: Awaited<ReturnType<typeof loader>>['namespace'];
  role: Awaited<ReturnType<typeof loader>>['role'];
  user: Awaited<ReturnType<typeof loader>>['user'];
  locales: string[];
  stats: Awaited<ReturnType<typeof loader>>['stats'];
};
