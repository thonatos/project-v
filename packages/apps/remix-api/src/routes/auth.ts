import { Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign, decode } from 'hono/jwt';
import { Provider } from '@supabase/supabase-js';
import { getUserId, removeUserId, setUserId } from '../util';

export const app = new Hono();

export const loginWithPassword = async (c: Context) => {
  const supabase = c.get('supabase');
  const { email, password } = await c.req.json<{
    email: string;
    password: string;
  }>();

  // params validation
  if (!email.includes('@')) {
    throw new HTTPException(400, { message: 'Invalid email' });
  }

  if (password.length < 8) {
    throw new HTTPException(400, { message: 'Password should be at least 12 characters' });
  }

  // auth with supabase
  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    throw new HTTPException(401, { message: 'Invalid email or password' });
  }

  return c.json({
    data,
  });
};

export const loginWithOAuth = async (c: Context) => {
  const provider = c.req.query('provider') || 'github';
  const supabase = c.get('supabase');
  const appUrl = c.env.AUTH_APP_URL || '';
  const callbackUrl = c.env.AUTH_CALLBACK_URL || '';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo: callbackUrl,
    },
  });

  if (error) {
    return c.redirect(appUrl);
  }

  return c.redirect(data.url);
};

export const oauthCallback = async (c: Context) => {
  const code = c.req.query('code');
  const next = c.req.query('next') || '/';
  const supabase = c.get('supabase');

  const appUrl = c.env.AUTH_APP_URL || '';
  const redirectUrl = new URL(appUrl);

  // params validation
  if (!code) {
    return c.redirect(redirectUrl.toString());
  }

  // exchange code for session
  const {
    data: { user },
    error,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (!user || error) {
    return c.redirect(redirectUrl.toString());
  }

  // check if user is registered
  const { data: queryData } = await supabase.from('users').select().eq('id', user.id).single();

  // if user is not registered, insert user to database
  if (!queryData) {
    const { data: _insertData, error: insertError } = await supabase
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

    if (insertError) {
      return c.redirect(redirectUrl.toString());
    }
  }

  // set user id cookie
  const userId = user.id;
  await setUserId(c, userId);

  // redirect to app url
  redirectUrl.pathname = next;
  return c.redirect(redirectUrl.toString());
};

export const logout = async (c: Context) => {
  const supabase = c.get('supabase');
  const appUrl = c.env.AUTH_APP_URL || '';

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error);
  }

  // remove user id cookie
  await removeUserId(c);

  return c.redirect(appUrl);
};

export const getProfile = async (c: Context) => {
  const jwtSecret = c.env.AUTH_JWT_SECRET || 'secret';
  const supabase = c.get('supabase');
  const user_id = await getUserId(c);

  // check if user is logged in
  if (!user_id) {
    throw new HTTPException(401, { message: 'user not logged in' });
  }

  // check if user is registered
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select()
    .eq('user_id', user_id)
    .single();
  const { data: credentialData } = await supabase
    .from('credentials')
    .select()
    .eq('user_id', user_id)
    .single();

  if (!userData || userError) {
    throw new HTTPException(401, { message: 'user not registered' });
  }

  const currentTime = Date.now();

  const profile = {
    exp: Math.floor(currentTime / 1000) + 60 * 60 * 24,
    iat: Math.floor(currentTime / 1000),

    id: userData.id,
    role: userData.role,
    name: userData.name,
    email: userData.email,
    avatar_url: userData.avatar_url,
  };
  const token = await sign(profile, jwtSecret, 'HS256');
  const payload = decode(token);

  return c.json({
    data: profile,
    token,
    payload,
    credential: {
      id: credentialData?.credential_id,
    },
  });
};

app.post('/password', loginWithPassword);

app.get('/oauth', loginWithOAuth);
app.get('/callback', oauthCallback);
app.get('/profile', getProfile);
app.get('/logout', logout);

export default app;
