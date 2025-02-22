import { Link, useActionData, useNavigate } from '@remix-run/react';
import { LoginForm } from '~/components/biz/login-form';
import { createClient } from '~/modules/supabase';

import type { MetaFunction, ActionFunctionArgs } from '@vercel/remix';

export const handle = {
  breadcrumb: () => <Link to="/auth/login">Login</Link>,
};

export const meta: MetaFunction = () => {
  return [{ title: 'Login' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));

  const errors: any = {};

  // params validation
  if (!email.includes('@')) {
    errors.email = 'Invalid email address';
  }

  if (password.length < 8) {
    errors.password = 'Password should be at least 12 characters';
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  // auth with supabase
  const { supabase } = createClient(request);
  const { data, error: AuthError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (AuthError) {
    errors.auth = AuthError;
    return { errors };
  }

  return {
    data,
  };
}

export const AuthLoginPage: React.FC<{}> = () => {
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  const handleOAuth = () => {
    navigate('/auth/oauth');
  };

  return (
    <div className="w-full max-w-sm md:max-w-4xl">
      <LoginForm onClickOAuth={handleOAuth} />
    </div>
  );
};

export default AuthLoginPage;
