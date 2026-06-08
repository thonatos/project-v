import { Form, Link, redirect, useActionData, useNavigation } from 'react-router';
import { Sparkles } from 'lucide-react';

import { registerUser, loginAndCreateSession, getUserId } from '~/lib/auth.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

import type { Route } from './+types/register';

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (userId) throw redirect('/dashboard');
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
    return loginAndCreateSession(user.id, '/dashboard');
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : '注册失败' };
  }
}

export function meta() {
  return [{ title: 'Register · i18n-studio' }];
}

export default function RegisterPage() {
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state === 'submitting';
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">i18n-studio</h1>
          <p className="text-sm text-muted-foreground">创建账号开始管理多语言词条</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>注册</CardTitle>
            <CardDescription>首位用户将自动获得 superuser 权限</CardDescription>
          </CardHeader>
          <CardContent>
            <Form method="post" className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">邮箱</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="displayName">显示名(可选)</Label>
                <Input id="displayName" name="displayName" type="text" autoComplete="nickname" />
              </div>
              {actionData?.error ? <p className="text-sm text-destructive">{actionData.error}</p> : null}
              <Button type="submit" disabled={submitting} className="mt-1">
                {submitting ? '提交中…' : '创建账号'}
              </Button>
            </Form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              已有账号?{' '}
              <Link to="/login" className="font-medium text-foreground hover:underline">
                去登录
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
