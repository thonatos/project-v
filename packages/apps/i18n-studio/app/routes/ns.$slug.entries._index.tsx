import { useMemo, useState } from 'react';
import { Form, useLoaderData, useRevalidator, useSearchParams } from 'react-router';

import { requireRole } from '~/lib/auth.server';
import { getNamespaceLocales, listNamespaces } from '~/lib/services/namespace.server';
import { listEntries } from '~/lib/services/query.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

import type { Route } from './+types/ns.$slug.entries._index';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
  const url = new URL(request.url);
  const prefix = url.searchParams.get('prefix') ?? undefined;
  const include = (url.searchParams.get('include') as 'published' | 'draft' | 'both' | null) ?? 'both';
  const status = (url.searchParams.get('status') as 'all' | 'draft' | null) ?? 'all';
  const cursor = url.searchParams.get('cursor');
  const result = listEntries(ctx.namespace.id, {
    prefix,
    view: 'all',
    include,
    status,
    cursor,
    pageSize: 50,
  });
  const allNamespaces = listNamespaces(ctx.user.id).filter((n) => n.slug !== ctx.namespace.slug);
  return {
    namespace: { id: ctx.namespace.id, slug: ctx.namespace.slug, name: ctx.namespace.name },
    role: ctx.role,
    locales: getNamespaceLocales(ctx.namespace),
    result,
    targetNamespaces: allNamespaces.map((n) => ({ id: n.id, slug: n.slug, name: n.name })),
  };
}

interface EntryRow {
  id: string;
  key: string;
  description: string | null;
  translations: Record<
    string,
    { value: string; version: number | null; missing?: boolean; draft?: { value: string; version: number } }
  >;
}

export default function EntriesPage() {
  const { namespace, role, locales, result, targetNamespaces } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const editable = role === 'admin' || role === 'editor';
  const entries: EntryRow[] = (result.entries ?? []) as EntryRow[];
  const revalidator = useRevalidator();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [showSync, setShowSync] = useState(false);

  const allChecked = entries.length > 0 && entries.every((e) => selected.has(e.id));
  const selectedEntries = useMemo(() => entries.filter((e) => selected.has(e.id)), [entries, selected]);

  const toggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.id)));
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const reset = () => {
    setSelected(new Set());
    revalidator.revalidate();
  };

  const draftItems = () => {
    const items: Array<{ entry_id: string; locale: string; version: number }> = [];
    for (const e of selectedEntries) {
      for (const l of locales) {
        const cell = e.translations[l];
        if (cell?.draft) items.push({ entry_id: e.id, locale: l, version: cell.draft.version });
      }
    }
    return items;
  };

  const publishDrafts = async () => {
    const items = draftItems();
    if (items.length === 0) {
      alert('选中词条没有 draft 可发布');
      return;
    }
    if (!confirm(`将发布 ${items.length} 条 draft,确认?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/namespaces/${namespace.slug}/publish-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        alert(`发布失败: ${res.status} ${await res.text()}`);
      }
    } finally {
      setBusy(false);
      reset();
    }
  };

  const discardDrafts = async () => {
    const items = draftItems();
    if (items.length === 0) {
      alert('选中词条没有 draft 可丢弃');
      return;
    }
    if (!confirm(`将丢弃 ${items.length} 条 draft,确认?`)) return;
    setBusy(true);
    try {
      let failed = 0;
      for (const it of items) {
        const entry = entries.find((e) => e.id === it.entry_id);
        if (!entry) continue;
        const res = await fetch(`/api/namespaces/${namespace.slug}/entries/${encodeURIComponent(entry.key)}/discard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: it.locale, version: it.version }),
        });
        if (!res.ok) failed++;
      }
      if (failed > 0) alert(`${failed} 条丢弃失败`);
    } finally {
      setBusy(false);
      reset();
    }
  };

  const deleteSelected = async () => {
    if (selectedEntries.length === 0) return;
    if (!confirm(`将删除 ${selectedEntries.length} 个词条(及其全部翻译/版本),确认?`)) return;
    setBusy(true);
    try {
      let failed = 0;
      for (const e of selectedEntries) {
        const res = await fetch(`/api/namespaces/${namespace.slug}/entries/${encodeURIComponent(e.key)}`, {
          method: 'DELETE',
        });
        if (!res.ok) failed++;
      }
      if (failed > 0) alert(`${failed} 个词条删除失败`);
    } finally {
      setBusy(false);
      reset();
    }
  };

  const pushTo = async (targetSlug: string, autoPublish: boolean) => {
    if (selectedEntries.length === 0) return;
    if (
      !confirm(
        `将当前选中的 ${selectedEntries.length} 个词条 ${autoPublish ? '直接发布' : '作为 draft'} 写入「${targetSlug}」,确认?`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/namespaces/${targetSlug}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceSlug: namespace.slug,
          entryIds: selectedEntries.map((e) => e.id),
          locales,
          strategy: 'overwrite',
          autoPublish,
          dryRun: false,
        }),
      });
      if (!res.ok) {
        alert(`同步失败: ${res.status} ${await res.text()}`);
      } else {
        const j = (await res.json()) as {
          created?: number;
          updated?: number;
          skipped?: number;
          bundleVersion?: number;
        };
        alert(
          `同步完成: created=${j.created ?? 0}, updated=${j.updated ?? 0}, skipped=${j.skipped ?? 0}` +
            (j.bundleVersion ? `,bundle_version=${j.bundleVersion}` : ''),
        );
      }
    } finally {
      setBusy(false);
      setShowSync(false);
      reset();
    }
  };

  return (
    <div className="space-y-4">
      <Form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Prefix</Label>
          <Input name="prefix" defaultValue={searchParams.get('prefix') ?? ''} placeholder="home." className="w-48" />
        </div>
        <div>
          <Label className="text-xs">Include</Label>
          <select
            name="include"
            defaultValue={searchParams.get('include') ?? 'both'}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="published">published</option>
            <option value="draft">draft</option>
            <option value="both">both</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <select
            name="status"
            defaultValue={searchParams.get('status') ?? 'all'}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">all</option>
            <option value="draft">only drafts</option>
          </select>
        </div>
        <Button type="submit" variant="outline">
          应用
        </Button>
        <Button type="button" variant="ghost" onClick={() => setSearchParams({})}>
          重置
        </Button>
        {editable ? <NewEntryButton slug={namespace.slug} /> : null}
      </Form>

      {editable && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm">
          <span className="font-medium">已选 {selected.size}</span>
          <span className="mx-2 h-4 w-px bg-border" />
          <Button type="button" size="sm" variant="default" disabled={busy} onClick={() => void publishDrafts()}>
            Publish drafts
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void discardDrafts()}>
            Discard drafts
          </Button>
          <div className="relative">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || targetNamespaces.length === 0}
              onClick={() => setShowSync((v) => !v)}
            >
              Push to ▾
            </Button>
            {showSync ? (
              <PushMenu
                targets={targetNamespaces}
                onPick={(slug, autoPublish) => void pushTo(slug, autoPublish)}
                onClose={() => setShowSync(false)}
              />
            ) : null}
          </div>
          <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void deleteSelected()}>
            Delete
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            取消选择
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {editable ? (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="全选"
                    checked={allChecked}
                    onChange={toggleAll}
                    disabled={entries.length === 0}
                  />
                </th>
              ) : null}
              <th className="px-3 py-2 text-left">key</th>
              {locales.map((l) => (
                <th key={l} className="px-3 py-2 text-left">
                  {l}
                </th>
              ))}
              {editable ? <th className="px-3 py-2"></th> : null}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td
                  colSpan={locales.length + (editable ? 3 : 1)}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  暂无词条
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <EntryRowView
                  key={e.id}
                  entry={e}
                  locales={locales}
                  editable={editable}
                  slug={namespace.slug}
                  checked={selected.has(e.id)}
                  onToggle={() => toggleOne(e.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      <PaginationButton nextCursor={result.page.nextCursor} />
    </div>
  );
}

function PushMenu({
  targets,
  onPick,
  onClose,
}: {
  targets: Array<{ id: string; slug: string; name: string }>;
  onPick: (slug: string, autoPublish: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 z-10 mt-1 w-72 rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
      <div className="px-2 pb-2 text-xs text-muted-foreground">选择目标命名空间</div>
      <div className="max-h-64 space-y-1 overflow-auto">
        {targets.map((t) => (
          <div key={t.id} className="rounded px-2 py-1 hover:bg-muted">
            <div className="font-medium">{t.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{t.slug}</div>
            <div className="mt-1 flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => onPick(t.slug, false)}>
                作为 draft
              </Button>
              <Button type="button" size="sm" variant="default" onClick={() => onPick(t.slug, true)}>
                直接发布
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          关闭
        </Button>
      </div>
    </div>
  );
}

function PaginationButton({ nextCursor }: { nextCursor: string | null }) {
  const [params, setParams] = useSearchParams();
  if (!nextCursor) return null;
  return (
    <Button
      variant="outline"
      onClick={() => {
        const next = new URLSearchParams(params);
        next.set('cursor', nextCursor);
        setParams(next);
      }}
    >
      下一页 →
    </Button>
  );
}

function NewEntryButton({ slug }: { slug: string }) {
  return (
    <Button asChild variant="default" className="ml-auto">
      <a href={`/ns/${slug}/entries/new`}>+ 新建词条</a>
    </Button>
  );
}

function EntryRowView({
  entry,
  locales,
  editable,
  slug,
  checked,
  onToggle,
}: {
  entry: EntryRow;
  locales: string[];
  editable: boolean;
  slug: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className="border-t">
      {editable ? (
        <td className="px-3 py-2">
          <input type="checkbox" aria-label={`选择 ${entry.key}`} checked={checked} onChange={onToggle} />
        </td>
      ) : null}
      <td className="px-3 py-2 font-mono text-xs">{entry.key}</td>
      {locales.map((l) => {
        const cell = entry.translations[l];
        return (
          <td key={l} className="px-3 py-2">
            {cell?.missing ? <span className="text-muted-foreground">(missing)</span> : cell?.value}
            {cell?.version ? <span className="ml-1 text-xs text-muted-foreground">v{cell.version}</span> : null}
            {cell?.draft ? (
              <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-900">draft v{cell.draft.version}</span>
            ) : null}
          </td>
        );
      })}
      {editable ? (
        <td className="px-3 py-2 text-right">
          <a
            href={`/ns/${slug}/entries/${encodeURIComponent(entry.key)}`}
            className="text-sm text-primary hover:underline"
          >
            编辑
          </a>
          <a
            href={`/ns/${slug}/entries/${encodeURIComponent(entry.key)}/history`}
            className="ml-3 text-sm text-primary hover:underline"
          >
            历史
          </a>
        </td>
      ) : null}
    </tr>
  );
}
