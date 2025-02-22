import { createClient } from '~/modules/supabase';

import type { ActionFunctionArgs } from '@vercel/remix';

export async function action({ request }: ActionFunctionArgs) {
  const post = await request.json();
  const { supabase } = createClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('posts')
    .insert({
      ...post,
      user_id: user?.id,
    })
    .select()
    .single();

  return Response.json({
    data,
    error,
  });
}
