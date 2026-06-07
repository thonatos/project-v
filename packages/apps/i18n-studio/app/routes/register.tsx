import { Form, redirect, useActionData, useNavigation } from 'react-router';

import { registerUser, loginAndCreateSession, getUserId } from '~/lib/auth.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

import type { Route } from './+types/register';

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (userId) throw redirect('/');
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  const displayName = String(form.get('displayName') ?? '');
  if (!email || password.length < 6) {
    return { error: '邮箱不能为空,密码至少 6 位' };
  }
  try {
    const user = await registerUser(email, password, displayName || undefined);
    return loginAndCreateSession(user.id, '/');
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : '注册失败' };
  }
}

export default function RegisterPage() {
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state === 'submitting';
  return (
    <main className="container mx-auto flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>注册</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="flex flex-col gap-3">
            <div>
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="password">密码</Label>
              <Input id="password" name="password" type="password" minLength={6} required />
            </div>
            <div>
              <Label htmlFor="displayName">显示名(可选)</Label>
              <Input id="displayName" name="displayName" type="text" />
            </div>
            {actionData?.error ? <p className="text-sm text-destructive">{actionData.error}</p> : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? '提交中…' : '创建账号'}
            </Button>
            <Button asChild variant="link">
              <a href="/login">已有账号?去登录</a>
            </Button>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
