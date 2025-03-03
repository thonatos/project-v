import { createClient } from '~/modules/supabase';
import type { ActionFunctionArgs } from '@vercel/remix';

export async function action({ request }: ActionFunctionArgs) {
  const { content, postId, parentId } = await request.json();
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

  if (!content || !postId) {
    return Response.json({
      status: 400,
      error: 'Missing required fields',
    });
  }

  const { status, error } = await supabase.from('comments').insert({
    content,
    post_id: postId,
    parent_id: parentId || null,
    user_id: user.id,
  });

  return Response.json({
    status,
    error,
  });
}
