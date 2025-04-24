import { Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { server } from '@passwordless-id/webauthn';
import { setUserId } from '../util';

const app = new Hono();

export const getPasskeyChallenge = async (c: Context) => {
  const challenge = server.randomChallenge();
  return c.json({
    data: challenge,
  });
};

export const registerPasskey = async (c: Context) => {
  const { registration, challenge } = await c.req.json<{ registration: any; challenge: string }>();
  const origin = c.req.header('Origin') || '';
  const supabase = c.get('supabase');
  const user_id = c.get('user_id');

  // check if user is logged in
  if (!user_id) {
    throw new HTTPException(401, { message: 'user not logged in' });
  }

  // check if credential already exists
  const { data: credentialData } = await supabase
    .from('credentials')
    .select()
    .eq('user_id', user_id)
    .single();

  if (credentialData) {
    throw new HTTPException(400, { message: 'credential already exists' });
  }

  const { data: userData } = await supabase.from('users').select().eq('id', user_id).single();

  // verify registration
  const expected = { challenge, origin };
  const registrationParsed = await server.verifyRegistration(registration, expected);
  const credential = registrationParsed.credential;

  if (userData?.email !== registrationParsed.user.name) {
    throw new HTTPException(400, { message: 'user email does not match' });
  }

  // insert credential to database
  const { data, error } = await supabase
    .from('credentials')
    .insert({
      user_id: user_id,
      credential_id: credential.id,
      credential_key: credential,
    })
    .select()
    .single();

  if (error) {
    throw new HTTPException(400, { message: 'failed to register credential' });
  }

  return c.json({
    data: {
      registration: data,
      registrationParsed,
    },
  });
};

export const authenticatePasskey = async (c: Context) => {
  const origin = c.req.header('Origin') || '';
  const { authentication, challenge } = await c.req.json<{ authentication: any; challenge: string }>();
  const supabase = c.get('supabase');
  const credentialId = authentication.id;

  const { data: credentialData } = await supabase
    .from('credentials')
    .select()
    .eq('credential_id', credentialId)
    .single();

  // console.log('credentialData', credentialData);
  const credentialKey = credentialData?.credential_key;

  // check if credential exists
  if (!credentialKey) {
    throw new HTTPException(400, { message: 'credential not found' });
  }

  const expected = {
    challenge,
    origin,
    userVerified: true,
  };

  // verify authentication
  try {
    const authenticationParsed = await server.verifyAuthentication(authentication, credentialKey, expected);
    await setUserId(c, credentialData.user_id);

    return c.json({
      data: {
        authenticationParsed,
      },
    });
  } catch (error) {
    throw new HTTPException(400, { message: 'authentication failed' });
  }
};

app.post('/challenge', getPasskeyChallenge);
app.post('/register', registerPasskey);
app.post('/authenticate', authenticatePasskey);

export default app;
