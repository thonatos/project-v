import { useLoaderData, useOutletContext } from 'react-router';
import { FileText, FolderOpen, Languages, Users } from 'lucide-react';

import { requireRole } from '~/lib/auth.server';
import { getNamespaceStats, getNamespaceLocales } from '~/lib/services/namespace.server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';

import type { Route } from './+types/dashboard.$slug._index';
import type { NsContext } from './dashboard.$slug';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
  return {
    stats: getNamespaceStats(ctx.namespace.id),
    locales: getNamespaceLocales(ctx.namespace),
    namespace: ctx.namespace,
  };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Overview · ${data?.namespace.name ?? 'i18n-studio'} · i18n-studio` }];
}

export default function NsOverview() {
  useOutletContext<NsContext>();
  const { stats, locales, namespace } = useLoaderData<typeof loader>();

  const cards: ReadonlyArray<{
    label: string;
    value: number;
    icon: typeof FileText;
    hint: string;
    highlight?: boolean;
  }> = [
    { label: 'Entries', value: stats.entriesCount, icon: FileText, hint: '已发布词条数' },
    {
      label: 'Drafts',
      value: stats.draftCount,
      icon: FolderOpen,
      hint: stats.draftCount > 0 ? '待审阅的草稿' : '暂无草稿',
      highlight: stats.draftCount > 0,
    },
    { label: 'Members', value: stats.membersCount, icon: Users, hint: '命名空间成员数' },
    {
      label: 'Locales',
      value: locales.length,
      icon: Languages,
      hint: locales.join(' · '),
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{namespace.name}</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{namespace.slug}</span> · bundle v{namespace.bundleVersion}
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
              <CardTitle className="text-sm text-muted-foreground">{c.label}</CardTitle>
              <span
                className={
                  c.highlight
                    ? 'grid size-7 place-items-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'grid size-7 place-items-center rounded-md bg-primary/10 text-primary'
                }
              >
                <c.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{c.value}</p>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{c.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Locales</CardTitle>
          <CardDescription>本命名空间已启用的语言。默认语言为 {namespace.defaultLocale}。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {locales.map((l) => (
              <Badge key={l} variant={l === namespace.defaultLocale ? 'default' : 'secondary'}>
                {l}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
