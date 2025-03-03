import { createClient } from '~/modules/supabase';
import type { ActionFunctionArgs } from '@vercel/remix';

export async function action({ request }: ActionFunctionArgs) {
  const { id } = await request.json();
  const { supabase } = createClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({
      status: 401,
      error: 'Unauthorized',
    });
  }

  if (!id) {
    return Response.json({
      status: 400,
      error: 'Missing comment id',
    });
  }

  const { status, error } = await supabase.from('comments').delete().match({
    id,
    user_id: user.id,
  });

  return Response.json({
    status,
    error,
  });
}
