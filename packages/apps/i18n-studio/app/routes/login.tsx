import { Form, Link, redirect, useActionData, useNavigation } from 'react-router';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { loginAndCreateSession, loginWithPassword, getUserId } from '~/lib/auth.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

import type { Route } from './+types/login';

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (userId) throw redirect('/dashboard');
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
  return loginAndCreateSession(user.id, '/dashboard');
}

export function meta() {
  return [{ title: 'Login · i18n-studio' }];
}

export default function LoginPage() {
  const { t } = useTranslation();
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
          <p className="text-sm text-muted-foreground">{t('common.auth.loginSubtitle')}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('common.auth.login')}</CardTitle>
            <CardDescription>{t('common.auth.loginHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form method="post" className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">{t('common.auth.email')}</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">{t('common.auth.password')}</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              {actionData?.error ? <p className="text-sm text-destructive">{actionData.error}</p> : null}
              <Button type="submit" disabled={submitting} className="mt-1">
                {submitting ? t('common.auth.loggingIn') : t('common.auth.login')}
              </Button>
            </Form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t('common.auth.noAccount')}{' '}
              <Link to="/register" className="font-medium text-foreground hover:underline">
                {t('common.auth.goRegister')}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
