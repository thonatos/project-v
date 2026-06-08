import * as React from 'react';
import { Form, redirect, useFetcher, useLoaderData, useOutletContext } from 'react-router';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { getUserId, requireUser } from '~/lib/auth.server';
import {
  createLocale,
  deleteLocale,
  listLocales,
  setEnabled,
  updateLocale,
  type Locale,
} from '~/lib/services/locale.server';
import { jsonError } from '~/lib/api.server';
import { AppShellHeader } from '~/components/app-shell';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';

import type { Route } from './+types/dashboard.locales';
import type { DashboardContext } from './dashboard';

export async function loader({ request }: Route.LoaderArgs) {
  // dashboard layout 已 requireUser
  const userId = await getUserId(request);
  if (!userId) throw redirect('/login');
  return { locales: listLocales() };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  if (!user.isSuperuser) {
    throw jsonError(403, 'forbidden', '仅 superuser 可管理语言库');
  }
  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  try {
    if (intent === 'create') {
      const code = String(form.get('code') ?? '')
        .trim()
        .toLowerCase();
      const label = String(form.get('label') ?? '').trim();
      const englishLabel = String(form.get('englishLabel') ?? '').trim();
      const nativeLabel = String(form.get('nativeLabel') ?? '').trim() || null;
      const region = String(form.get('region') ?? '').trim() || null;
      const row = createLocale({ code, label, englishLabel, nativeLabel, region });
      return { ok: true as const, intent, row };
    }
    if (intent === 'update') {
      const code = String(form.get('code') ?? '').trim();
      const label = String(form.get('label') ?? '').trim();
      const englishLabel = String(form.get('englishLabel') ?? '').trim();
      const nativeLabel = String(form.get('nativeLabel') ?? '').trim() || null;
      const region = String(form.get('region') ?? '').trim() || null;
      const row = updateLocale(code, { label, englishLabel, nativeLabel, region });
      return { ok: true as const, intent, row };
    }
    if (intent === 'toggle') {
      const code = String(form.get('code') ?? '').trim();
      const enabled = form.get('enabled') === 'true';
      const row = setEnabled(code, enabled);
      return { ok: true as const, intent, row };
    }
    if (intent === 'delete') {
      const code = String(form.get('code') ?? '').trim();
      deleteLocale(code);
      return { ok: true as const, intent, code };
    }
    return { ok: false as const, error: 'unknown intent' };
  } catch (e) {
    if (e instanceof Response) {
      try {
        const body = (await e.clone().json()) as { code?: string; message?: string };
        return { ok: false as const, error: body.message ?? 'failed', code: body.code };
      } catch {
        throw e;
      }
    }
    return { ok: false as const, error: e instanceof Error ? e.message : 'failed' };
  }
}

export function meta() {
  return [{ title: 'Locales · i18n-studio' }];
}

type EditingState = { mode: 'create' } | { mode: 'edit'; row: Locale } | null;

export default function LocalesPage() {
  const { locales } = useLoaderData<typeof loader>();
  const { user, theme } = useOutletContext<DashboardContext>();
  const fetcher = useFetcher<typeof action>();
  const [editing, setEditing] = React.useState<EditingState>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Locale | null>(null);
  const [disableConfirm, setDisableConfirm] = React.useState<Locale | null>(null);

  React.useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return;
    const data = fetcher.data;
    if (data.ok) {
      setEditing(null);
      setDeleteTarget(null);
      const intent = 'intent' in data ? data.intent : '';
      if (intent === 'create') toast.success('已添加语言');
      else if (intent === 'update') toast.success('已更新');
      else if (intent === 'toggle') toast.success('状态已更新');
      else if (intent === 'delete') toast.success('已删除');
    } else if (data.error) {
      toast.error(data.error);
    }
  }, [fetcher.state, fetcher.data]);

  const isSuperuser = user.isSuperuser;

  return (
    <div>
      <AppShellHeader
        user={user}
        theme={theme}
        crumbs={[{ label: 'System', to: '/dashboard/locales' }, { label: 'Locales' }]}
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">语言库</h1>
            <p className="text-sm text-muted-foreground">
              系统级语言字典。
              {isSuperuser
                ? '在此添加、编辑、启停、删除语言;命名空间的多选组件仅展示已启用项。'
                : '只读视图。仅 superuser 可修改字典内容。'}
            </p>
          </div>
          {isSuperuser ? (
            <Button onClick={() => setEditing({ mode: 'create' })}>
              <Plus className="size-4" /> 新增语言
            </Button>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">字典 ({locales.length})</CardTitle>
            <CardDescription>按 sortOrder 升序展示。</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>code</TableHead>
                  <TableHead>label</TableHead>
                  <TableHead>english</TableHead>
                  <TableHead>native</TableHead>
                  <TableHead>region</TableHead>
                  <TableHead>type</TableHead>
                  <TableHead>status</TableHead>
                  {isSuperuser ? <TableHead className="w-32 text-right">操作</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {locales.map((l) => (
                  <TableRow key={l.code}>
                    <TableCell className="font-mono text-xs">{l.code}</TableCell>
                    <TableCell>{l.label}</TableCell>
                    <TableCell className="text-muted-foreground">{l.englishLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{l.nativeLabel ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{l.region ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={l.isBuiltin ? 'secondary' : 'outline'}>
                        {l.isBuiltin ? 'builtin' : 'custom'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={l.enabled ? 'success' : 'secondary'}>{l.enabled ? 'enabled' : 'disabled'}</Badge>
                    </TableCell>
                    {isSuperuser ? (
                      <TableCell className="text-right">
                        {l.isBuiltin && l.enabled ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={fetcher.state !== 'idle'}
                            onClick={() => setDisableConfirm(l)}
                          >
                            禁用
                          </Button>
                        ) : (
                          <fetcher.Form method="post" className="inline">
                            <input type="hidden" name="intent" value="toggle" />
                            <input type="hidden" name="code" value={l.code} />
                            <input type="hidden" name="enabled" value={String(!l.enabled)} />
                            <Button type="submit" size="sm" variant="ghost" disabled={fetcher.state !== 'idle'}>
                              {l.enabled ? '禁用' : '启用'}
                            </Button>
                          </fetcher.Form>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ mode: 'edit', row: l })}>
                          <Pencil className="size-3.5" />
                        </Button>
                        {!l.isBuiltin ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(l)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {isSuperuser ? (
        <>
          <Sheet open={editing !== null} onOpenChange={(v) => !v && setEditing(null)}>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>{editing?.mode === 'edit' ? `编辑 ${editing.row.code}` : '新增语言'}</SheetTitle>
              </SheetHeader>
              <Form method="post" className="mt-4 flex flex-col gap-3">
                <input type="hidden" name="intent" value={editing?.mode === 'edit' ? 'update' : 'create'} />
                {editing?.mode === 'edit' ? <input type="hidden" name="code" value={editing.row.code} /> : null}
                {editing?.mode === 'create' ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="code">code</Label>
                    <Input
                      id="code"
                      name="code"
                      required
                      pattern="[a-z]{2,3}(-[a-z]{2,4})?"
                      placeholder="vi-vn"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">小写 BCP-47 风格,例如 `vi-vn`、`th-th`</p>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="label">中文名</Label>
                  <Input
                    id="label"
                    name="label"
                    required
                    defaultValue={editing?.mode === 'edit' ? editing.row.label : ''}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="englishLabel">English Name</Label>
                  <Input
                    id="englishLabel"
                    name="englishLabel"
                    required
                    defaultValue={editing?.mode === 'edit' ? editing.row.englishLabel : ''}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nativeLabel">母语名(可选)</Label>
                  <Input
                    id="nativeLabel"
                    name="nativeLabel"
                    defaultValue={editing?.mode === 'edit' ? (editing.row.nativeLabel ?? '') : ''}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="region">region(可选,ISO 3166)</Label>
                  <Input
                    id="region"
                    name="region"
                    placeholder="VN"
                    defaultValue={editing?.mode === 'edit' ? (editing.row.region ?? '') : ''}
                  />
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                    取消
                  </Button>
                  <Button type="submit">保存</Button>
                </div>
              </Form>
            </SheetContent>
          </Sheet>

          <Dialog open={deleteTarget !== null} onOpenChange={(v) => !v && setDeleteTarget(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>删除语言 {deleteTarget?.code}?</DialogTitle>
                <DialogDescription>
                  将永久从字典中移除该语言。仅未被任何 namespace 引用且非内置的语言可删除。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                  取消
                </Button>
                <Form
                  method="post"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!deleteTarget) return;
                    fetcher.submit({ intent: 'delete', code: deleteTarget.code }, { method: 'post' });
                  }}
                >
                  <Button type="submit" variant="destructive">
                    确认删除
                  </Button>
                </Form>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={disableConfirm !== null} onOpenChange={(v) => !v && setDisableConfirm(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>禁用内置语言 {disableConfirm?.code}?</DialogTitle>
                <DialogDescription>
                  禁用 {disableConfirm?.label} 后,新建 namespace 默认会无法选中该语言;若多语言字典前 3 项全部被禁用,新建
                  namespace 将无可选 locale。确认要禁用此内置语言吗?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDisableConfirm(null)}>
                  取消
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (!disableConfirm) return;
                    fetcher.submit(
                      { intent: 'toggle', code: disableConfirm.code, enabled: 'false' },
                      { method: 'post' },
                    );
                    setDisableConfirm(null);
                  }}
                >
                  确认禁用
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
