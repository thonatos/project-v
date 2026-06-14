import { Link, useLoaderData, useOutletContext } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Boxes, Languages, Plus, Sparkles, Users } from 'lucide-react';

import { listNamespaces } from '~/lib/services/namespace.server';
import { AppShellHeader } from '~/components/app-shell';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { getUserId } from '~/lib/auth.server';
import { redirect } from 'react-router';

import type { Route } from './+types/dashboard._index';
import type { DashboardContext } from './dashboard';

export async function loader({ request }: Route.LoaderArgs) {
  // dashboard layout 已 requireUser;此处只取 id 用于 listNamespaces
  const userId = await getUserId(request);
  if (!userId) throw redirect('/login');
  return { namespaces: listNamespaces(userId) };
}

export function meta() {
  return [{ title: 'Namespaces · i18n-studio' }];
}

export default function DashboardIndex() {
  const { namespaces } = useLoaderData<typeof loader>();
  const { user, theme, lang } = useOutletContext<DashboardContext>();
  const { t } = useTranslation();
  return (
    <div>
      <AppShellHeader user={user} theme={theme} lang={lang} />
      <main className="mx-auto w-full max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('common.dashboard.namespaces')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('common.dashboard.namespacesDescription')}
              <span className="hidden text-muted-foreground/80 sm:inline">
                {' '}
                {t('common.dashboard.commandPaletteHint')}
              </span>
            </p>
          </div>
          <Button asChild>
            <Link to="/dashboard/new">
              <Plus className="size-4" />
              {t('common.dashboard.newNamespace')}
            </Link>
          </Button>
        </div>

        {namespaces.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {namespaces.map((ns) => {
              const locales = JSON.parse(ns.locales) as string[];
              return (
                <Link key={ns.id} to={`/dashboard/${ns.slug}`} className="group block">
                  <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                            <Boxes className="size-4" />
                          </span>
                          <div>
                            <CardTitle className="text-base">{ns.name}</CardTitle>
                            <CardDescription className="font-mono text-xs">{ns.slug}</CardDescription>
                          </div>
                        </div>
                        <Badge variant={ns.role === 'admin' ? 'default' : 'secondary'}>{ns.role}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Languages className="size-3.5" />
                          {locales.length} locales
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" />
                          {ns.role === 'admin' ? 'Owner' : 'Member'}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">{locales.join(' · ')}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-background py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">尚未加入任何命名空间</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        命名空间是多语言词条管理的隔离单元。新建一个命名空间开始使用,或邀请同事将你加入现有空间。
      </p>
      <Button asChild className="mt-5">
        <Link to="/dashboard/new">
          <Plus className="size-4" />
          新建命名空间
        </Link>
      </Button>
    </div>
  );
}
