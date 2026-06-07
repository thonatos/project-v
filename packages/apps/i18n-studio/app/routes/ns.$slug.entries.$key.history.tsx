import { useLoaderData, useRevalidator } from 'react-router';

import { requireRole } from '~/lib/auth.server';
import { getEntryByKey } from '~/lib/services/entry.server';
import { listEntryVersions } from '~/lib/services/version.server';
import { getNamespaceLocales } from '~/lib/services/namespace.server';
import { Button } from '~/components/ui/button';
import { formatDateTime } from '~/lib/utils';

import type { Route } from './+types/ns.$slug.entries.$key.history';

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
    role: ctx.role,
    key,
    locales: allLocales,
    localeFilter,
    history,
  };
}

export default function HistoryPage() {
  const { slug, role, key, locales, localeFilter, history } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const editable = role === 'admin' || role === 'editor';

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
      } catch {}
      alert(msg);
      return;
    }
    revalidator.revalidate();
  };

  return (
    <div className="space-y-3">
      <a
        href={`/ns/${slug}/entries/${encodeURIComponent(key)}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← 返回词条
      </a>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">
          历史:<span className="font-mono">{key}</span>
        </h1>
        <span className="ml-2 text-xs text-muted-foreground">筛选 locale:</span>
        <a
          href={`/ns/${slug}/entries/${encodeURIComponent(key)}/history`}
          className={
            'rounded px-2 py-0.5 text-xs ' +
            (localeFilter === ''
              ? 'bg-primary text-primary-foreground'
              : 'border bg-background text-foreground hover:bg-muted')
          }
        >
          全部
        </a>
        {locales.map((l) => (
          <a
            key={l}
            href={`/ns/${slug}/entries/${encodeURIComponent(key)}/history?locale=${l}`}
            className={
              'rounded px-2 py-0.5 text-xs ' +
              (l === localeFilter
                ? 'bg-primary text-primary-foreground'
                : 'border bg-background text-foreground hover:bg-muted')
            }
          >
            {l}
          </a>
        ))}
      </div>

      {history.versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无历史版本。</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">locale</th>
                <th className="px-3 py-2 text-left">version</th>
                <th className="px-3 py-2 text-left">status</th>
                <th className="px-3 py-2 text-left">source</th>
                <th className="px-3 py-2 text-left">value</th>
                <th className="px-3 py-2 text-left">actor</th>
                <th className="px-3 py-2 text-left">time</th>
                {editable ? <th className="px-3 py-2 text-right">操作</th> : null}
              </tr>
            </thead>
            <tbody>
              {history.versions.map((v) => {
                const cur = history.currentPublishedByLocale[v.locale];
                const isCurrent = cur === v.version;
                return (
                  <tr key={v.id} className="border-t align-top">
                    <td className="px-3 py-2 font-mono text-xs">{v.locale}</td>
                    <td className="px-3 py-2 font-mono">
                      {isCurrent ? <span title="当前发布版本">★ </span> : ''}v{v.version}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="px-3 py-2 text-xs">{v.source}</td>
                    <td className="max-w-md truncate px-3 py-2">{v.value}</td>
                    <td className="px-3 py-2 text-xs">{v.actorId}</td>
                    <td className="px-3 py-2 text-xs">{formatDateTime(v.createdAt)}</td>
                    {editable ? (
                      <td className="px-3 py-2 text-right">
                        <RowActions
                          status={v.status}
                          isCurrent={isCurrent}
                          onPublish={() => void call('publish', v.locale, v.version)}
                          onDiscard={() => void call('discard', v.locale, v.version)}
                          onRevert={() => {
                            if (confirm(`回滚 ${v.locale} 到 v${v.version}?会基于该内容创建一个新的 published 版本。`))
                              void call('revert', v.locale, v.version);
                          }}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {history.nextCursor ? (
        <p className="text-xs text-muted-foreground">仅展示最近 200 条。如需更早的版本可联系管理员或导出。</p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'published'
      ? 'bg-emerald-100 text-emerald-900'
      : status === 'draft'
        ? 'bg-amber-100 text-amber-900'
        : 'bg-zinc-200 text-zinc-700';
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
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
