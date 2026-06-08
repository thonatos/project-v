import { useMemo, useState } from 'react';
import { Form, Link, useLoaderData, useRevalidator, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { CheckCircle2, ChevronDown, Database, PencilLine, Plus, RefreshCw, Send, Trash2, Undo2 } from 'lucide-react';

import { requireRole } from '~/lib/auth.server';
import { getNamespaceLocales, listNamespaces } from '~/lib/services/namespace.server';
import { listEntries } from '~/lib/services/query.server';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { Separator } from '~/components/ui/separator';

import type { Route } from './+types/dashboard.$slug.entries._index';

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

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Entries · ${data?.namespace.name ?? 'i18n-studio'} · i18n-studio` }];
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

type ConfirmKind = 'publish' | 'discard' | 'delete' | 'push';
interface PushIntent {
  targetSlug: string;
  targetName: string;
  autoPublish: boolean;
}
interface ConfirmState {
  kind: ConfirmKind;
  count: number;
  push?: PushIntent;
}

export default function EntriesPage() {
  const { namespace, role, locales, result, targetNamespaces } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const editable = role === 'admin' || role === 'editor';
  const entries: EntryRow[] = (result.entries ?? []) as EntryRow[];
  const revalidator = useRevalidator();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const allChecked = entries.length > 0 && entries.every((e) => selected.has(e.id));
  const selectedEntries = useMemo(() => entries.filter((e) => selected.has(e.id)), [entries, selected]);

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(entries.map((e) => e.id)));
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

  const requestPublish = () => {
    const items = draftItems();
    if (items.length === 0) {
      toast.warning('选中词条没有 draft 可发布');
      return;
    }
    setConfirmState({ kind: 'publish', count: items.length });
  };
  const requestDiscard = () => {
    const items = draftItems();
    if (items.length === 0) {
      toast.warning('选中词条没有 draft 可丢弃');
      return;
    }
    setConfirmState({ kind: 'discard', count: items.length });
  };
  const requestDelete = () => {
    if (selectedEntries.length === 0) return;
    setConfirmState({ kind: 'delete', count: selectedEntries.length });
  };
  const requestPush = (targetSlug: string, targetName: string, autoPublish: boolean) => {
    if (selectedEntries.length === 0) return;
    setConfirmState({
      kind: 'push',
      count: selectedEntries.length,
      push: { targetSlug, targetName, autoPublish },
    });
  };

  const runConfirmed = async () => {
    if (!confirmState) return;
    setBusy(true);
    try {
      if (confirmState.kind === 'publish') {
        const items = draftItems();
        const res = await fetch(`/api/namespaces/${namespace.slug}/publish-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
        if (res.ok) toast.success(`已发布 ${items.length} 条 draft`);
        else toast.error(`发布失败: ${res.status} ${await res.text()}`);
      } else if (confirmState.kind === 'discard') {
        const items = draftItems();
        const results = await Promise.allSettled(
          items.map((it) => {
            const entry = entries.find((e) => e.id === it.entry_id);
            if (!entry) return Promise.reject(new Error('entry not found'));
            return fetch(`/api/namespaces/${namespace.slug}/entries/${encodeURIComponent(entry.key)}/discard`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ locale: it.locale, version: it.version }),
            }).then((r) => {
              if (!r.ok) throw new Error(`${r.status}`);
              return r;
            });
          }),
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        const ok = results.length - failed;
        if (failed > 0) toast.error(`已丢弃 ${ok} 条,${failed} 条失败`);
        else toast.success(`已丢弃 ${ok} 条 draft`);
      } else if (confirmState.kind === 'delete') {
        const results = await Promise.allSettled(
          selectedEntries.map((e) =>
            fetch(`/api/namespaces/${namespace.slug}/entries/${encodeURIComponent(e.key)}`, {
              method: 'DELETE',
            }).then((r) => {
              if (!r.ok) throw new Error(`${r.status}`);
              return r;
            }),
          ),
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        const ok = results.length - failed;
        if (failed > 0) toast.error(`已删除 ${ok} 个,${failed} 个失败`);
        else toast.success(`已删除 ${ok} 个词条`);
      } else if (confirmState.kind === 'push' && confirmState.push) {
        const { targetSlug, autoPublish } = confirmState.push;
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
          toast.error(`同步失败: ${res.status} ${await res.text()}`);
        } else {
          const j = (await res.json()) as {
            created?: number;
            updated?: number;
            skipped?: number;
            bundleVersion?: number;
          };
          toast.success(
            `同步完成: created=${j.created ?? 0}, updated=${j.updated ?? 0}, skipped=${j.skipped ?? 0}` +
              (j.bundleVersion ? `,bundle v${j.bundleVersion}` : ''),
          );
        }
      }
    } finally {
      setBusy(false);
      setConfirmState(null);
      reset();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entries</h1>
          <p className="text-sm text-muted-foreground">浏览、编辑、发布、跨空间推送词条。</p>
        </div>
        {editable ? (
          <Button asChild>
            <Link to={`/dashboard/${namespace.slug}/entries/new`}>
              <Plus className="size-4" /> 新建词条
            </Link>
          </Button>
        ) : null}
      </div>

      <Form method="get" className="flex flex-wrap items-end gap-3 rounded-md border bg-background p-3">
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
      </Form>

      {editable && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm">
          <span className="font-medium">已选 {selected.size}</span>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button type="button" size="sm" disabled={busy} onClick={requestPublish}>
            <CheckCircle2 className="size-4" /> Publish drafts
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={requestDiscard}>
            <Undo2 className="size-4" /> Discard drafts
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" disabled={busy || targetNamespaces.length === 0}>
                <Send className="size-4" /> Push to <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>选择目标命名空间</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {targetNamespaces.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">没有其他可推送的命名空间</div>
              ) : (
                targetNamespaces.map((t) => (
                  <div key={t.id} className="px-1 py-1">
                    <div className="px-2 text-sm font-medium">{t.name}</div>
                    <div className="px-2 font-mono text-xs text-muted-foreground">{t.slug}</div>
                    <div className="mt-1 flex gap-2 px-2 pb-1">
                      <Button size="sm" variant="outline" onClick={() => requestPush(t.slug, t.name, false)}>
                        作为 draft
                      </Button>
                      <Button size="sm" onClick={() => requestPush(t.slug, t.name, true)}>
                        直接发布
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={requestDelete}>
            <Trash2 className="size-4" /> Delete
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            取消选择
          </Button>
        </div>
      ) : null}

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              {editable ? (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="全选"
                    checked={allChecked}
                    onChange={toggleAll}
                    disabled={entries.length === 0}
                  />
                </TableHead>
              ) : null}
              <TableHead>key</TableHead>
              {locales.map((l) => (
                <TableHead key={l}>{l}</TableHead>
              ))}
              {editable ? <TableHead className="w-32 text-right">操作</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={locales.length + (editable ? 3 : 1)} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    <Database className="size-8 opacity-40" />
                    <span>暂无词条</span>
                    {editable ? (
                      <Button asChild variant="outline" size="sm" className="mt-2">
                        <Link to={`/dashboard/${namespace.slug}/entries/new`}>
                          <Plus className="size-3.5" /> 新建词条
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
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
          </TableBody>
        </Table>
      </div>
      <PaginationButton nextCursor={result.page.nextCursor} />

      <Dialog open={confirmState !== null} onOpenChange={(v) => !v && setConfirmState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTitle(confirmState)}</DialogTitle>
            <DialogDescription>{confirmDescription(confirmState)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmState(null)} disabled={busy}>
              取消
            </Button>
            <Button
              variant={confirmState?.kind === 'delete' ? 'destructive' : 'default'}
              disabled={busy}
              onClick={() => void runConfirmed()}
            >
              {busy ? '执行中…' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function confirmTitle(state: ConfirmState | null): string {
  if (!state) return '';
  switch (state.kind) {
    case 'publish':
      return `发布 ${state.count} 条 draft?`;
    case 'discard':
      return `丢弃 ${state.count} 条 draft?`;
    case 'delete':
      return `删除 ${state.count} 个词条?`;
    case 'push':
      return `推送 ${state.count} 个词条到「${state.push?.targetName ?? ''}」?`;
  }
}

function confirmDescription(state: ConfirmState | null): string {
  if (!state) return '';
  switch (state.kind) {
    case 'publish':
      return '将选中词条的草稿推送到 published,bundle_version 共享一次 +1。';
    case 'discard':
      return '将选中词条的草稿标记为已丢弃,操作不可撤销。';
    case 'delete':
      return '将连同其全部翻译与版本一并删除,操作不可撤销。';
    case 'push':
      return state.push?.autoPublish
        ? '将以「直接发布」方式写入目标命名空间(覆盖既有 published)。'
        : '将以「draft」方式写入目标命名空间,需要在目标空间显式 publish。';
  }
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
    <TableRow data-state={checked ? 'selected' : undefined}>
      {editable ? (
        <TableCell>
          <input type="checkbox" aria-label={`选择 ${entry.key}`} checked={checked} onChange={onToggle} />
        </TableCell>
      ) : null}
      <TableCell className="font-mono text-xs">
        <Link to={`/dashboard/${slug}/entries/${encodeURIComponent(entry.key)}`} className="hover:underline">
          {entry.key}
        </Link>
        {entry.description ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] font-sans text-muted-foreground">{entry.description}</p>
        ) : null}
      </TableCell>
      {locales.map((l) => {
        const cell = entry.translations[l];
        return (
          <TableCell key={l} className="align-top">
            {cell?.missing ? (
              <span className="text-muted-foreground">(missing)</span>
            ) : (
              <div className="line-clamp-2 max-w-xs whitespace-pre-wrap break-words text-sm">{cell?.value}</div>
            )}
            <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              {cell?.version ? <span>v{cell.version}</span> : null}
              {cell?.draft ? (
                <Badge variant="warning" className="text-[10px]">
                  draft v{cell.draft.version}
                </Badge>
              ) : null}
            </div>
          </TableCell>
        );
      })}
      {editable ? (
        <TableCell className="text-right">
          <Button asChild variant="ghost" size="sm">
            <Link to={`/dashboard/${slug}/entries/${encodeURIComponent(entry.key)}`}>
              <PencilLine className="size-3.5" />
              编辑
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/dashboard/${slug}/entries/${encodeURIComponent(entry.key)}/history`}>
              <RefreshCw className="size-3.5" />
              历史
            </Link>
          </Button>
        </TableCell>
      ) : null}
    </TableRow>
  );
}
