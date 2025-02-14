import { redirect } from '@remix-run/react';
import { createClient } from '~/supabase-module';

import type { LoaderFunctionArgs } from '@vercel/remix';

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabase, headers } = createClient(request);
  const { error } = await supabase.auth.signOut();

  if (error) {
    return redirect('/auth/login', { headers });
  }

  return redirect('/', { headers });
}
