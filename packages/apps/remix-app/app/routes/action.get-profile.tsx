import jwt from 'jsonwebtoken';
import { createClient } from '~/modules/supabase';
import type { LoaderFunctionArgs } from '@vercel/remix';

export async function loader({ request }: LoaderFunctionArgs) {
  const privateKey = process.env.AUTH_JWT_SECRET || 'secret';

  try {
    const { supabase } = createClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let data = null;
    let token = null;
    let payload = null;

    if (user) {
      const { data: userData, error } = await supabase.from('users').select().eq('user_id', user.id).single();

      if (userData) {
        data = {
          id: userData.id,
          role: userData.role,
          name: userData.name,
          email: userData.email,
          avatar_url: userData.avatar_url,
        };

        token = jwt.sign(data, privateKey, { algorithm: 'HS256', expiresIn: '1d' });
        payload = jwt.decode(token);
      }
    }

    return Response.json({
      data,
      token,
      payload,
    });
  } catch (error) {
    return Response.json({
      data: null,
    });
  }
}
