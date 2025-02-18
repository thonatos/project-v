import { redirect } from '@remix-run/react';
import { createClient } from '~/supabase-module';

import type { LoaderFunctionArgs } from '@vercel/remix';

export async function loader({ request }: LoaderFunctionArgs) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';
  const { supabase, headers } = createClient(request);

  if (code) {
    // query from auth.users
    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (user) {
      // query from public.users
      const { data, error: _queryError } = await supabase.from('users').select().eq('id', user.id).single();

      if (!data) {
        // create public.users
        const { data: _insertData, error: _insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            role: 'user',
            email: user.email,
            name: user.user_metadata.full_name,
            avatar_url: user.user_metadata.avatar_url,
            user_id: user.id,
          })
          .select()
          .single();
      }
    }

    if (!error) {
      return redirect(next, { headers });
    }
  }

  return redirect('/auth/login', { headers });
}
