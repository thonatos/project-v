import { createClient } from '~/modules/supabase';

import type { ActionFunctionArgs } from '@vercel/remix';

export async function action({ request }: ActionFunctionArgs) {
  const post = await request.json();
  const { supabase } = createClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({
      error: 'Unauthorized',
    });
  }

  if (!post.id) {
    return Response.json({
      error: 'Missing post id',
    });
  }

  const { status, error } = await supabase.from('posts').delete().match({
    id: post.id,
    user_id: user.id,
  });

  return Response.json({
    status,
    error,
  });
}
