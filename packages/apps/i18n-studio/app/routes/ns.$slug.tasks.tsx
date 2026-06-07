import { useLoaderData, Form, redirect } from 'react-router';

import { requireRole } from '~/lib/auth.server';
import { listTasks, createTask, cancelTask } from '~/lib/services/task.server';
import { getNamespaceLocales } from '~/lib/services/namespace.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

import type { Route } from './+types/ns.$slug.tasks';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? undefined;
  return {
    namespace: ctx.namespace,
    role: ctx.role,
    locales: getNamespaceLocales(ctx.namespace),
    tasks: listTasks(ctx.namespace.id, status),
  };
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
      throw redirect(`/ns/${ctx.namespace.slug}/tasks`);
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

export default function TasksPage() {
  const { namespace, role, locales, tasks } = useLoaderData<typeof loader>();
  const editable = role === 'admin' || role === 'editor';
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">翻译任务</h1>
      {editable ? (
        <Form method="post" className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <input type="hidden" name="intent" value="create" />
          <div>
            <Label className="text-xs">目标 locales(逗号分隔)</Label>
            <Input name="targetLocales" placeholder="en-us,zh-tw" required />
          </div>
          <div>
            <Label className="text-xs">prefix(可选)</Label>
            <Input name="prefix" placeholder="home." />
          </div>
          <div>
            <Label className="text-xs">missing in locale(可选)</Label>
            <Input name="missingLocale" placeholder="en-us" />
          </div>
          <Button type="submit">新建任务</Button>
          <p className="ml-2 text-xs text-muted-foreground">已启用 locales: {locales.join(', ')}</p>
        </Form>
      ) : null}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">id</th>
              <th className="px-3 py-2 text-left">status</th>
              <th className="px-3 py-2 text-left">targets</th>
              <th className="px-3 py-2 text-left">progress</th>
              <th className="px-3 py-2 text-left">worker</th>
              <th className="px-3 py-2 text-left">created</th>
              {role === 'admin' ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  暂无任务
                </td>
              </tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{t.id.slice(0, 10)}…</td>
                  <td className="px-3 py-2">{t.status}</td>
                  <td className="px-3 py-2 text-xs">{(JSON.parse(t.targetLocales) as string[]).join(',')}</td>
                  <td className="px-3 py-2">
                    {t.done} / {t.total}
                  </td>
                  <td className="px-3 py-2 text-xs">{t.workerId ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
                  {role === 'admin' ? (
                    <td className="px-3 py-2 text-right">
                      {t.status === 'pending' || t.status === 'in_progress' ? (
                        <Form method="post">
                          <input type="hidden" name="intent" value="cancel" />
                          <input type="hidden" name="taskId" value={t.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            取消
                          </Button>
                        </Form>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">命名空间:{namespace.slug}</p>
    </div>
  );
}
