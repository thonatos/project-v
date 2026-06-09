import * as React from 'react';
import { Form, Link, NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CommandIcon, Languages, LogOut, Menu, Sparkles, User as UserIcon } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '~/components/ui/sheet';
import { ThemeToggle } from '~/components/theme-toggle';
import { LangToggle } from '~/components/lang-toggle';
import { cn } from '~/lib/utils';
import type { Theme } from '~/lib/theme';
import type { Lang } from '~/lib/i18n';

interface BreadcrumbCrumb {
  label: string;
  to?: string;
}

interface AppShellHeaderProps {
  user?: { email: string; displayName?: string | null; isSuperuser?: boolean } | null;
  theme: Theme;
  lang: Lang;
  crumbs?: BreadcrumbCrumb[];
  /** Optional left-side slot rendered before the brand (e.g. dashboard subnav Sheet trigger) */
  leadingSlot?: React.ReactNode;
}

function initials(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '?';
  const before = trimmed.split('@')[0]!;
  const parts = before.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return before.slice(0, 2).toUpperCase();
}

const NAV_ITEM_BASE = 'rounded-md px-3 py-1.5 text-sm font-medium transition-colors';

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    NAV_ITEM_BASE,
    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
  );
}

interface NavLinks {
  user: AppShellHeaderProps['user'];
}

function PrimaryNav({ user }: NavLinks) {
  const { t } = useTranslation('common');
  if (!user) return null;
  return (
    <nav className="hidden items-center gap-0.5 md:flex" aria-label={t('shell.mainNav')}>
      <NavLink to="/dashboard" className={navLinkClass}>
        {t('nav.dashboard')}
      </NavLink>
    </nav>
  );
}

function MobileNav({ user }: NavLinks) {
  const { t } = useTranslation('common');
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="md:hidden" aria-label={t('shell.openMenu')}>
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>i18n-studio</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1 px-4" aria-label={t('shell.mobileNav')}>
          {user ? (
            <Link to="/dashboard" onClick={close} className="rounded-md px-3 py-2 text-sm hover:bg-accent">
              {t('nav.dashboard')}
            </Link>
          ) : null}
          {user ? <div className="my-2 border-t" /> : null}
          {user ? (
            <Form method="post" action="/logout">
              <button
                type="submit"
                onClick={close}
                className="inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <LogOut className="size-4" />
                {t('auth.logout')}
              </button>
            </Form>
          ) : (
            <>
              <Link to="/login" onClick={close} className="rounded-md px-3 py-2 text-sm hover:bg-accent">
                {t('auth.login')}
              </Link>
              <Link
                to="/register"
                onClick={close}
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                {t('auth.register')}
              </Link>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function AppShellHeader({ user, theme, lang, crumbs, leadingSlot }: AppShellHeaderProps) {
  const { t } = useTranslation('common');
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4">
        {leadingSlot}
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="hidden sm:inline">i18n-studio</span>
        </Link>
        {crumbs && crumbs.length > 0 ? (
          <>
            <span className="text-muted-foreground">/</span>
            <Breadcrumb className="hidden md:block">
              <BreadcrumbList>
                {crumbs.map((crumb, idx) => {
                  const isLast = idx === crumbs.length - 1;
                  return (
                    <React.Fragment key={`${crumb.label}-${idx}`}>
                      <BreadcrumbItem>
                        {isLast || !crumb.to ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={crumb.to}>{crumb.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {isLast ? null : <BreadcrumbSeparator />}
                    </React.Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <PrimaryNav user={user} />
          <span
            className="hidden items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground lg:flex"
            aria-label={t('shell.commandKeyHint')}
          >
            <CommandIcon className="size-3" />
            <span>K</span>
          </span>
          <LangToggle lang={lang} className="hidden sm:inline-flex" />
          <ThemeToggle theme={theme} className="hidden sm:inline-flex" />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="rounded-full">
                  <Avatar>
                    <AvatarFallback>{initials(user.email)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.displayName ?? user.email.split('@')[0]}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">
                    <UserIcon className="size-4" />
                    {t('menu.namespaces')}
                  </Link>
                </DropdownMenuItem>
                {user.isSuperuser ? (
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/locales">
                      <Languages className="size-4" />
                      {t('menu.manageLocales')}
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <Form method="post" action="/logout">
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOut className="size-4" />
                      {t('auth.logout')}
                    </button>
                  </DropdownMenuItem>
                </Form>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" asChild size="sm">
                <Link to="/login">{t('auth.login')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/register">{t('auth.register')}</Link>
              </Button>
            </div>
          )}
          <MobileNav user={user} />
        </div>
      </div>
    </header>
  );
}
