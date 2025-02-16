import { redirect } from '@remix-run/react';
import { createClient } from '~/supabase-module';

import type { LoaderFunctionArgs } from '@vercel/remix';

const REDIRECT_URL = 'https://remix.implements.io/auth/callback';

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabase, headers } = createClient(request);
  const redirectTo = process.env.AUTH_CALLBACK_URL || REDIRECT_URL;

  // console.log('redirectTo', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo,
    },
  });

  if (error) {
    return redirect('/auth/login', { headers });
  }

  return redirect(data.url, { headers });
}
