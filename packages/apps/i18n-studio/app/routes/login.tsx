import { Form, redirect, useActionData, useNavigation } from 'react-router';

import { loginAndCreateSession, loginWithPassword, getUserId } from '~/lib/auth.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

import type { Route } from './+types/login';

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (userId) throw redirect('/');
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  if (!email || !password) {
    return { error: '请填写邮箱与密码' };
  }
  const user = await loginWithPassword(email, password);
  if (!user) {
    return { error: '邮箱或密码错误' };
  }
  return loginAndCreateSession(user.id, '/');
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state === 'submitting';
  return (
    <main className="container mx-auto flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>登录</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="flex flex-col gap-3">
            <div>
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="password">密码</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {actionData?.error ? <p className="text-sm text-destructive">{actionData.error}</p> : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? '登录中…' : '登录'}
            </Button>
            <Button asChild variant="link">
              <a href="/register">没有账号?去注册</a>
            </Button>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
