import { useFetcher, useLoaderData, Form } from 'react-router';

import { requireRole } from '~/lib/auth.server';
import { listMembers, inviteByEmail, updateRole, removeMember } from '~/lib/services/membership.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

import type { Route } from './+types/ns.$slug.members';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin']);
  return { namespace: ctx.namespace, members: listMembers(ctx.namespace.id), self: ctx.user };
}

export async function action({ request, params }: Route.ActionArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin']);
  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  if (intent === 'invite') {
    const email = String(form.get('email') ?? '');
    const role = String(form.get('role') ?? 'editor') as 'admin' | 'editor' | 'viewer';
    try {
      inviteByEmail(ctx.namespace.id, email, role);
      return { ok: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'invite failed' };
    }
  }
  if (intent === 'update') {
    const userId = String(form.get('userId') ?? '');
    const role = String(form.get('role') ?? 'viewer') as 'admin' | 'editor' | 'viewer';
    try {
      updateRole(ctx.namespace.id, userId, role);
      return { ok: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'update failed' };
    }
  }
  if (intent === 'remove') {
    const userId = String(form.get('userId') ?? '');
    try {
      removeMember(ctx.namespace.id, userId);
      return { ok: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'remove failed' };
    }
  }
  return { error: 'unknown intent' };
}

export default function MembersPage() {
  const { namespace, members, self } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">成员</h1>
      <Form method="post" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="intent" value="invite" />
        <div>
          <Label className="text-xs">邮箱</Label>
          <Input name="email" type="email" required />
        </div>
        <div>
          <Label className="text-xs">角色</Label>
          <select name="role" defaultValue="editor" className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="admin">admin</option>
            <option value="editor">editor</option>
            <option value="viewer">viewer</option>
          </select>
        </div>
        <Button type="submit">邀请</Button>
      </Form>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">用户</th>
              <th className="px-3 py-2 text-left">角色</th>
              <th className="px-3 py-2 text-left">加入时间</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2">
                  {m.email}
                  {m.userId === self.id ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                </td>
                <td className="px-3 py-2">
                  <select
                    defaultValue={m.role}
                    onChange={(e) => {
                      const role = e.target.value;
                      fetcher.submit({ intent: 'update', userId: m.userId, role }, { method: 'POST' });
                    }}
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="admin">admin</option>
                    <option value="editor">editor</option>
                    <option value="viewer">viewer</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(m.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`移除 ${m.email}?`)) {
                        fetcher.submit({ intent: 'remove', userId: m.userId }, { method: 'POST' });
                      }
                    }}
                  >
                    移除
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">命名空间:{namespace.slug} · 不允许移除最后一名 admin</p>
    </div>
  );
}
