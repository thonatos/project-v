import { Form, Link, redirect, useActionData, useLoaderData } from 'react-router';

import { getUser } from '~/lib/auth.server';
import { acceptInvitation } from '~/lib/services/invitation.server';
import { getDb } from '~/lib/db.server';
import { namespaces, namespaceInvitations } from '~/db/schema';
import { eq } from 'drizzle-orm';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

import type { Route } from './+types/invite.$token';

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await getUser(request);
  return { token: params.token!, user: user ? { id: user.id, email: user.email } : null };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await getUser(request);
  if (!user) return { error: '请先登录或注册后再接受邀请' };
  try {
    const result = acceptInvitation(params.token!, user.id);
    const db = getDb();
    const invitation = db
      .select()
      .from(namespaceInvitations)
      .where(eq(namespaceInvitations.id, result.invitation.id))
      .get()!;
    const ns = db.select().from(namespaces).where(eq(namespaces.id, invitation.namespaceId)).get();
    throw redirect(ns ? `/dashboard/${ns.slug}` : '/dashboard');
  } catch (e) {
    if (e instanceof Response && e.status >= 300 && e.status < 400) throw e;
    return { error: e instanceof Error ? e.message : 'accept failed' };
  }
}

export function meta() {
  return [{ title: 'Accept invitation · i18n-studio' }];
}

export default function InvitePage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>接受邀请</CardTitle>
          <CardDescription>请使用收到邀请的邮箱登录或注册。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user ? (
            <Form method="post">
              <p className="mb-4 text-sm text-muted-foreground">
                当前登录邮箱:<span className="font-mono">{user.email}</span>
              </p>
              <Button type="submit">接受邀请</Button>
            </Form>
          ) : (
            <div className="flex gap-2">
              <Button asChild>
                <Link to="/login">登录</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/register">注册</Link>
              </Button>
            </div>
          )}
          {actionData?.error ? <p className="text-sm text-destructive">{actionData.error}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
