import { Context } from 'hono';
import { sign, decode } from 'hono/jwt';

export const login = async (c: Context) => {
  const supabase = c.get('supabase');
  const { email, password } = await c.req.json<{
    email: string;
    password: string;
  }>();

  const errors: any = {};

  // params validation
  if (!email.includes('@')) {
    errors.email = 'Invalid email address';
  }

  if (password.length < 8) {
    errors.password = 'Password should be at least 12 characters';
  }

  if (Object.keys(errors).length > 0) {
    return c.json({ errors });
  }

  // auth with supabase
  const { data, error: AuthError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (AuthError) {
    errors.auth = AuthError;
    return c.json({ errors });
  }

  return c.json({
    data,
  });
};

export const oauth = async (c: Context) => {
  const supabase = c.get('supabase');
  const appUrl = c.env.AUTH_APP_URL || '';
  const callbackUrl = c.env.AUTH_CALLBACK_URL || '';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: callbackUrl,
    },
  });

  if (error) {
    return c.redirect(appUrl);
  }

  return c.redirect(data.url);
};

export const callback = async (c: Context) => {
  const code = c.req.query('code');
  const next = c.req.query('next') || '/';
  const supabase = c.get('supabase');

  const appUrl = c.env.AUTH_APP_URL || '';
  const redirectUrl = new URL(appUrl);

  if (code) {
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
      redirectUrl.pathname = next;
      return c.redirect(redirectUrl.toString());
    }
  }

  return c.redirect(redirectUrl.toString());
};

export const profile = async (c: Context) => {
  const privateKey = c.env.AUTH_JWT_SECRET || 'secret';
  const supabase = c.get('supabase');
  try {
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

        token = await sign(data, privateKey, 'HS256');
        payload = decode(token);
      }
    }

    return c.json({
      data,
      token,
      payload,
    });
  } catch (error) {
    return c.json({
      data: null,
    });
  }
};
