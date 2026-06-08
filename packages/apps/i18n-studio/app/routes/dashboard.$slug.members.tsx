import * as React from 'react';
import { useFetcher, useLoaderData, Form, useOutletContext } from 'react-router';
import { Trash2, UserPlus } from 'lucide-react';

import { requireRole } from '~/lib/auth.server';
import { listMembers, inviteByEmail, updateRole, removeMember } from '~/lib/services/membership.server';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';

import type { Route } from './+types/dashboard.$slug.members';
import type { NsContext } from './dashboard.$slug';

type MemberRole = 'admin' | 'editor' | 'viewer';

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
    const role = String(form.get('role') ?? 'editor') as MemberRole;
    try {
      inviteByEmail(ctx.namespace.id, email, role);
      return { ok: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'invite failed' };
    }
  }
  if (intent === 'update') {
    const userId = String(form.get('userId') ?? '');
    const role = String(form.get('role') ?? 'viewer') as MemberRole;
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

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Members · ${data?.namespace.name ?? 'i18n-studio'} · i18n-studio` }];
}

export default function MembersPage() {
  useOutletContext<NsContext>();
  const { namespace, members, self } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [removeTarget, setRemoveTarget] = React.useState<{ userId: string; email: string } | null>(null);
  const [inviteRole, setInviteRole] = React.useState<MemberRole>('editor');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">成员</h1>
        <p className="text-sm text-muted-foreground">
          管理 <span className="font-mono">{namespace.slug}</span> 的协作成员;不允许移除最后一名 admin。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">邀请成员</CardTitle>
          <CardDescription>对方需先在 i18n-studio 注册并使用同一邮箱。</CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="grid items-end gap-3 sm:grid-cols-[1fr_180px_auto]">
            <input type="hidden" name="intent" value="invite" />
            <input type="hidden" name="role" value={inviteRole} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-role">角色</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="editor">editor</SelectItem>
                  <SelectItem value="viewer">viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">
              <UserPlus className="size-4" /> 邀请
            </Button>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">成员列表 ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead className="w-44">角色</TableHead>
                <TableHead>加入时间</TableHead>
                <TableHead className="w-20 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const isSelf = m.userId === self.id;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{m.email}</span>
                        {isSelf ? <span className="text-xs text-muted-foreground">(you)</span> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        defaultValue={m.role}
                        onValueChange={(role) => {
                          fetcher.submit({ intent: 'update', userId: m.userId, role }, { method: 'POST' });
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">admin</SelectItem>
                          <SelectItem value="editor">editor</SelectItem>
                          <SelectItem value="viewer">viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={isSelf}
                        onClick={() => setRemoveTarget({ userId: m.userId, email: m.email })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={removeTarget !== null} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移除 {removeTarget?.email}?</DialogTitle>
            <DialogDescription>该用户将不再可访问本命名空间下的任何资源,操作不可撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (removeTarget) {
                  fetcher.submit({ intent: 'remove', userId: removeTarget.userId }, { method: 'POST' });
                }
                setRemoveTarget(null);
              }}
            >
              确认移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
