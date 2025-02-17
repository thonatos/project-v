import { createClient } from '~/supabase-module';
import type { LoaderFunctionArgs } from '@vercel/remix';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { supabase } = createClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return Response.json({
      data: user,
    });
  } catch (error) {
    return Response.json({
      data: null,
    });
  }
}
