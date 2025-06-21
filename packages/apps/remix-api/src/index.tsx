import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { timing } from 'hono/timing';
import { logger } from 'hono/logger';

import { JwtMiddleware } from './middlewares/jwt';
import { IsLoginMiddleware } from './middlewares/is-login';
import { IsAdminMiddleware } from './middlewares/is-admin';
import { SupabaseMiddleware } from './middlewares/supabase';

import auth from './routes/auth';
import blog from './routes/blog';
import chat from './routes/chat';
import conf from './routes/conf';
import charge from './routes/charge';
import passkey from './routes/passkey';

import { HomePage } from './components/home';

import { CORS_ORIGINS } from './constants';

import type { JwtVariables } from 'hono/jwt';
import type { TimingVariables } from 'hono/timing';

export type Variables = JwtVariables & TimingVariables;

export interface Env {
  AI: Ai;
}

export type Bindings = {
  AUTH_APP_URL: string;
  AUTH_CALLBACK_URL: string;

  AUTH_JWT_SECRET: string;
  AUTH_ADMIN_EMAIL: string;

  AUTH_COOKIE_DOMAIN: string;
  AUTH_COOKIE_SRCRET: string;

  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  COINBASE_API_KEY: string;

  AI: {
    run: (model: string, inputs: any) => Promise<any>;
  };
};

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.use(timing());
app.use(logger());
app.use(
  cors({
    maxAge: 600,
    credentials: true,
    allowMethods: ['HEAD', 'POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
    origin: (origin) => {
      if (CORS_ORIGINS.some((o) => origin.includes(o))) {
        return origin;
      }

      return '.implements.io';
    },
  })
);

app.use('*', SupabaseMiddleware());

app.use(
  '*',
  IsLoginMiddleware({
    GET: ['/auth/oauth', '/auth/callback', '/blog/post', '/blog/posts', '/blog/categories', '/conf'],
    POST: [
      '/auth/password',
      '/passkey/challenge',
      '/passkey/register',
      '/passkey/authenticate',
      '/charge/create',
    ],
  })
);

app.use('/chat/*', JwtMiddleware());
app.use('/chat/*', IsAdminMiddleware());

app.get('/', async (c) => {
  return c.html(<HomePage />);
});

app.route('/conf', conf);
app.route('/auth', auth);
app.route('/blog', blog);
app.route('/chat', chat);
app.route('/charge', charge);
app.route('/passkey', passkey);

export default app;
