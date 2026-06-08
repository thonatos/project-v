import * as React from 'react';
import { Link, useLoaderData, useOutletContext, useRevalidator } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '~/lib/auth.server';
import { getEntryByKey } from '~/lib/services/entry.server';
import { listEntryVersions } from '~/lib/services/version.server';
import { getNamespaceLocales } from '~/lib/services/namespace.server';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { formatDateTime } from '~/lib/utils';

import type { Route } from './+types/dashboard.$slug.entries.$key.history';
import type { NsContext } from './dashboard.$slug';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
  const url = new URL(request.url);
  const allLocales = getNamespaceLocales(ctx.namespace);
  const filter = url.searchParams.get('locale') ?? '';
  const localeFilter = filter && allLocales.includes(filter) ? filter : '';
  const key = decodeURIComponent(params.key!);
  const entry = getEntryByKey(ctx.namespace.id, key);
  if (!entry) throw new Response('Not Found', { status: 404 });
  const history = listEntryVersions(entry.id, {
    locale: localeFilter || undefined,
    limit: 200,
  });
  return {
    slug: ctx.namespace.slug,
    namespaceName: ctx.namespace.name,
    role: ctx.role,
    key,
    locales: allLocales,
    localeFilter,
    history,
  };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: 'History · i18n-studio' }];
  return [{ title: `History · ${data.key} · ${data.namespaceName} · i18n-studio` }];
}

type VersionStatus = 'draft' | 'published' | 'discarded';

function statusVariant(status: VersionStatus): React.ComponentProps<typeof Badge>['variant'] {
  switch (status) {
    case 'published':
      return 'success';
    case 'draft':
      return 'secondary';
    case 'discarded':
      return 'outline';
    default:
      return 'outline';
  }
}

export default function HistoryPage() {
  useOutletContext<NsContext>();
  const { slug, role, key, locales, localeFilter, history } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const editable = role === 'admin' || role === 'editor';
  const [revertTarget, setRevertTarget] = React.useState<{ locale: string; version: number } | null>(null);

  const call = async (path: 'publish' | 'revert' | 'discard', locale: string, version: number) => {
    const url = `/api/namespaces/${slug}/entries/${encodeURIComponent(key)}/${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale, version }),
    });
    if (!res.ok) {
      let msg = `${path} 失败`;
      try {
        const j = (await res.json()) as { message?: string };
        if (j?.message) msg = j.message;
      } catch {
        /* ignore */
      }
      toast.error(msg);
      return;
    }
    toast.success(`${path} 成功`);
    revalidator.revalidate();
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={`/dashboard/${slug}/entries/${encodeURIComponent(key)}`}>
          <ArrowLeft className="size-4" /> 返回词条
        </Link>
      </Button>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          历史:<span className="font-mono">{key}</span>
        </h1>
        <p className="text-sm text-muted-foreground">追踪每个 locale 的版本流转,支持发布草稿、回滚到任意版本。</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">筛选 locale:</span>
        <Button asChild size="sm" variant={localeFilter === '' ? 'default' : 'outline'}>
          <Link to={`/dashboard/${slug}/entries/${encodeURIComponent(key)}/history`}>全部</Link>
        </Button>
        {locales.map((l) => (
          <Button key={l} asChild size="sm" variant={l === localeFilter ? 'default' : 'outline'}>
            <Link to={`/dashboard/${slug}/entries/${encodeURIComponent(key)}/history?locale=${l}`}>
              <span className="font-mono">{l}</span>
            </Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">版本列表 ({history.versions.length})</CardTitle>
          {history.nextCursor ? (
            <CardDescription>仅展示最近 200 条。如需更早的版本可联系管理员或导出。</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {history.versions.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">暂无历史版本。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>locale</TableHead>
                  <TableHead>version</TableHead>
                  <TableHead>status</TableHead>
                  <TableHead>source</TableHead>
                  <TableHead>value</TableHead>
                  <TableHead>actor</TableHead>
                  <TableHead>time</TableHead>
                  {editable ? <TableHead className="text-right">操作</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.versions.map((v) => {
                  const cur = history.currentPublishedByLocale[v.locale];
                  const isCurrent = cur === v.version;
                  return (
                    <TableRow key={v.id} className="align-top">
                      <TableCell className="font-mono text-xs">{v.locale}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {isCurrent ? <span title="当前发布版本">★ </span> : ''}v{v.version}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(v.status as VersionStatus)}>{v.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{v.source}</TableCell>
                      <TableCell className="max-w-md truncate">{v.value}</TableCell>
                      <TableCell className="font-mono text-xs">{v.actorId}</TableCell>
                      <TableCell className="text-xs">{formatDateTime(v.createdAt)}</TableCell>
                      {editable ? (
                        <TableCell className="text-right">
                          <RowActions
                            status={v.status}
                            isCurrent={isCurrent}
                            onPublish={() => void call('publish', v.locale, v.version)}
                            onDiscard={() => void call('discard', v.locale, v.version)}
                            onRevert={() => setRevertTarget({ locale: v.locale, version: v.version })}
                          />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={revertTarget !== null} onOpenChange={(v) => !v && setRevertTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              回滚 {revertTarget?.locale} 到 v{revertTarget?.version}?
            </DialogTitle>
            <DialogDescription>会基于该版本的内容创建一条新的 published 版本,bundle_version +1。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevertTarget(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (revertTarget) void call('revert', revertTarget.locale, revertTarget.version);
                setRevertTarget(null);
              }}
            >
              确认回滚
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowActions({
  status,
  isCurrent,
  onPublish,
  onDiscard,
  onRevert,
}: {
  status: string;
  isCurrent: boolean;
  onPublish: () => void;
  onDiscard: () => void;
  onRevert: () => void;
}) {
  if (status === 'discarded') {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (status === 'draft') {
    return (
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="default" onClick={onPublish}>
          Publish
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    );
  }
  if (isCurrent) {
    return <span className="text-xs text-muted-foreground">当前</span>;
  }
  return (
    <Button type="button" size="sm" variant="outline" onClick={onRevert}>
      Revert
    </Button>
  );
}
