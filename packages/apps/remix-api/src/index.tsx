import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { JwtVariables } from 'hono/jwt';
import { logger } from 'hono/logger';
import type { TimingVariables } from 'hono/timing';
import { timing } from 'hono/timing';
import { HomePage } from './components/home';
import { CORS_ORIGINS } from './constants';
import { IsAdminMiddleware } from './middlewares/is-admin';
import { IsLoginMiddleware } from './middlewares/is-login';
import { JwtMiddleware } from './middlewares/jwt';
import { SupabaseMiddleware } from './middlewares/supabase';
import auth from './routes/auth';
import blog from './routes/blog';
import charge from './routes/charge';
import chat from './routes/chat';
import conf from './routes/conf';
import passkey from './routes/passkey';

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
    run: (model: string, inputs: unknown) => Promise<unknown>;
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
  }),
);

app.use('*', SupabaseMiddleware());

app.use(
  '*',
  IsLoginMiddleware({
    GET: ['/auth/oauth', '/auth/callback', '/blog/post', '/blog/posts', '/blog/categories', '/conf'],
    POST: ['/auth/password', '/passkey/challenge', '/passkey/register', '/passkey/authenticate', '/charge/create'],
  }),
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
