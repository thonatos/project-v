import * as React from 'react';
import { useLoaderData, Form, redirect, useOutletContext } from 'react-router';
import { Plus, X } from 'lucide-react';

import { requireRole } from '~/lib/auth.server';
import { listTasks, createTask, cancelTask } from '~/lib/services/task.server';
import { getNamespaceLocales } from '~/lib/services/namespace.server';
import { listEnabledLocales } from '~/lib/services/locale.server';
import { LocaleMultiSelect, type LocaleOption } from '~/components/locale-multi-select';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';

import type { Route } from './+types/dashboard.$slug.tasks';
import type { NsContext } from './dashboard.$slug';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? undefined;
  const enabledLocales = listEnabledLocales();
  const localeOptions: LocaleOption[] = enabledLocales.map((l) => ({
    code: l.code,
    label: l.label,
    englishLabel: l.englishLabel,
    nativeLabel: l.nativeLabel,
  }));
  return {
    namespace: ctx.namespace,
    role: ctx.role,
    locales: getNamespaceLocales(ctx.namespace),
    tasks: listTasks(ctx.namespace.id, status),
    localeOptions,
  };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Tasks · ${data?.namespace.name ?? 'i18n-studio'} · i18n-studio` }];
}

export async function action({ request, params }: Route.ActionArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor']);
  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  if (intent === 'create') {
    const targetLocalesRaw = String(form.get('targetLocales') ?? '');
    const prefix = String(form.get('prefix') ?? '');
    const missingLocale = String(form.get('missingLocale') ?? '');
    const targetLocales = targetLocalesRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (targetLocales.length === 0) return { error: '目标 locales 不能为空' };
    try {
      createTask({
        namespaceId: ctx.namespace.id,
        targetLocales,
        filter: { prefix: prefix || undefined, missingLocale: missingLocale || undefined },
        createdBy: ctx.user.id,
      });
      throw redirect(`/dashboard/${ctx.namespace.slug}/tasks`);
    } catch (e) {
      if (e instanceof Response) throw e;
      return { error: e instanceof Error ? e.message : 'create failed' };
    }
  }
  if (intent === 'cancel') {
    if (ctx.role !== 'admin') return { error: '仅 admin 可取消任务' };
    const id = String(form.get('taskId') ?? '');
    cancelTask(id);
    return { ok: true };
  }
  return { error: 'unknown intent' };
}

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

function statusVariant(status: string): React.ComponentProps<typeof Badge>['variant'] {
  switch (status as TaskStatus) {
    case 'pending':
      return 'secondary';
    case 'in_progress':
      return 'default';
    case 'completed':
      return 'success';
    case 'failed':
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default function TasksPage() {
  useOutletContext<NsContext>();
  const { namespace, role, locales, tasks, localeOptions } = useLoaderData<typeof loader>();
  const editable = role === 'admin' || role === 'editor';
  const [targetLocales, setTargetLocales] = React.useState<string[]>([]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">翻译任务</h1>
        <p className="text-sm text-muted-foreground">
          创建任务后,worker 通过 task 范围的 token 拉取与回写。本命名空间已启用 locales:{locales.join(', ')}。
        </p>
      </header>

      {editable ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">新建任务</CardTitle>
            <CardDescription>选择 prefix / missingLocale 任意一个或都不填(全量),并指定目标 locales。</CardDescription>
          </CardHeader>
          <CardContent>
            <Form method="post" className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="intent" value="create" />
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <Label>目标 locales</Label>
                <LocaleMultiSelect
                  value={targetLocales}
                  onChange={setTargetLocales}
                  options={localeOptions}
                  name="targetLocales"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prefix">prefix(可选)</Label>
                <Input id="prefix" name="prefix" placeholder="home." className="font-mono" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="missingLocale">missing in locale(可选)</Label>
                <Input id="missingLocale" name="missingLocale" placeholder="en-us" className="font-mono" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">
                  <Plus className="size-4" /> 新建任务
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">任务列表 ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>id</TableHead>
                <TableHead>status</TableHead>
                <TableHead>targets</TableHead>
                <TableHead>progress</TableHead>
                <TableHead>worker</TableHead>
                <TableHead>created</TableHead>
                {role === 'admin' ? <TableHead className="w-20 text-right">操作</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={role === 'admin' ? 7 : 6} className="py-8 text-center text-muted-foreground">
                    暂无任务
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((t) => {
                  const targetList = JSON.parse(t.targetLocales) as string[];
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.id.slice(0, 10)}…</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                          {targetList.map((l) => (
                            <Badge key={l} variant="outline" className="font-mono">
                              {l}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {t.done} / {t.total}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.workerId ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </TableCell>
                      {role === 'admin' ? (
                        <TableCell className="text-right">
                          {t.status === 'pending' || t.status === 'in_progress' ? (
                            <Form method="post" className="inline">
                              <input type="hidden" name="intent" value="cancel" />
                              <input type="hidden" name="taskId" value={t.id} />
                              <Button type="submit" size="sm" variant="ghost">
                                <X className="size-3.5" />
                              </Button>
                            </Form>
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        命名空间:<span className="font-mono">{namespace.slug}</span>
      </p>
    </div>
  );
}
