import { Link, useActionData } from 'react-router';
import { LoginForm } from '~/components/biz/login-form';
import { loginWithPassword } from '~/service/auth';

import type { Route } from './+types/auth.login';

export const handle = {
  breadcrumb: () => <Link to="/auth/login">Login</Link>,
};

export const meta = ({}: Route.MetaArgs) => {
  return [{ title: 'Login' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));

  const data = await loginWithPassword(email, password);
  return data;
}

export default function ({}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <div className="w-full max-w-sm md:max-w-4xl">
      <LoginForm />
    </div>
  );
}
