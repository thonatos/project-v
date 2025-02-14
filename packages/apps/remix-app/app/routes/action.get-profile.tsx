import { createClient } from '~/supabase-module';

import type { LoaderFunctionArgs } from '@vercel/remix';

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabase } = createClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return Response.json({
    data: user,
  });
}
