import { createClient } from '~/supabase-module';

import type { LoaderFunctionArgs } from '@vercel/remix';

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabase } = createClient(request);

  const { data, error } = await supabase.from('categories').select();

  return Response.json({
    data,
    error,
  });
}
