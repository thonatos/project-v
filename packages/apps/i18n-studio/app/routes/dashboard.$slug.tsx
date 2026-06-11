import * as React from 'react';
import { Link, NavLink, Outlet, useLoaderData, useOutletContext } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Boxes, FileText, ListChecks, Menu, RefreshCw, Settings, Users } from 'lucide-react';

import { requireRole } from '~/lib/auth.server';
import { getNamespaceStats, getNamespaceLocales } from '~/lib/services/namespace.server';
import { AppShellHeader } from '~/components/app-shell';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '~/components/ui/sheet';
import { cn } from '~/lib/utils';

import type { Route } from './+types/dashboard.$slug';
import type { DashboardContext } from './dashboard';

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

export type NsContext = {
  namespace: Awaited<ReturnType<typeof loader>>['namespace'];
  role: Awaited<ReturnType<typeof loader>>['role'];
  user: Awaited<ReturnType<typeof loader>>['user'];
  locales: string[];
  stats: Awaited<ReturnType<typeof loader>>['stats'];
};

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

export default function NamespaceLayout() {
  const { namespace, role, user, stats, locales } = useLoaderData<typeof loader>();
  const { theme, lang } = useOutletContext<DashboardContext>();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const navItems: NavItem[] = [
    { to: '.', label: t('common.namespaceNav.overview'), icon: Boxes, end: true },
    { to: 'entries', label: t('common.namespaceNav.entries'), icon: FileText },
    { to: 'tasks', label: t('common.namespaceNav.tasks'), icon: ListChecks },
    { to: 'sync', label: t('common.namespaceNav.sync'), icon: RefreshCw },
  ];
  if (role === 'admin') {
    navItems.push({ to: 'members', label: t('common.namespaceNav.members'), icon: Users });
    navItems.push({ to: 'settings', label: t('common.namespaceNav.settings'), icon: Settings });
  }

  const crumbs = [{ label: 'Namespaces', to: '/dashboard' }, { label: namespace.name }];

  return (
    <div>
      <AppShellHeader
        user={user}
        theme={theme}
        lang={lang}
        crumbs={crumbs}
        leadingSlot={
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="md:hidden">
                <Menu className="size-5" />
                <span className="sr-only">{t('common.namespaceNav.openSidebar')}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b p-4">
                <SheetTitle>{namespace.name}</SheetTitle>
              </SheetHeader>
              <nav className="p-3">
                <SidebarLinks items={navItems} onNavigate={() => setMobileOpen(false)} />
              </nav>
              <SidebarMeta stats={stats} bundleVersion={namespace.bundleVersion} />
            </SheetContent>
          </Sheet>
        }
      />
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <Link
            to={`/dashboard/${namespace.slug}`}
            className="mb-3 block rounded-md border bg-background p-3 transition-colors hover:bg-accent/40"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Namespace</p>
            <p className="truncate text-sm font-semibold">{namespace.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{namespace.slug}</p>
            <div className="mt-2 flex items-center justify-between">
              <Badge variant="secondary" className="text-[10px]">
                {role}
              </Badge>
              <span className="text-[10px] text-muted-foreground">bv {namespace.bundleVersion}</span>
            </div>
          </Link>
          <SidebarLinks items={navItems} />
          <SidebarMeta stats={stats} bundleVersion={namespace.bundleVersion} compact />
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet context={{ namespace, role, user, locales, stats } satisfies NsContext} />
        </main>
      </div>
    </div>
  );
}

function SidebarLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {items.map((it) => (
        <li key={it.to}>
          <NavLink
            to={it.to}
            end={it.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                isActive && 'bg-accent font-medium text-foreground',
              )
            }
          >
            <it.icon className="size-4" />
            <span>{it.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function SidebarMeta({
  stats,
  bundleVersion,
  compact,
}: {
  stats: { entriesCount: number; draftCount: number; membersCount: number };
  bundleVersion: number;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn('mt-4 rounded-md border bg-background p-3 text-xs text-muted-foreground', compact && 'mt-3')}>
      <div className="flex items-center justify-between">
        <span>{t('common.sidebar.entries')}</span>
        <span className="font-medium text-foreground">{stats.entriesCount}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span>{t('common.sidebar.drafts')}</span>
        <span
          className={cn('font-medium', stats.draftCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}
        >
          {stats.draftCount}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span>{t('common.sidebar.members')}</span>
        <span className="font-medium text-foreground">{stats.membersCount}</span>
      </div>
      <div className="mt-2 border-t pt-2 text-[10px] uppercase tracking-wider">bundle v{bundleVersion}</div>
    </div>
  );
}
