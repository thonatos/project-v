import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { timing } from 'hono/timing';
import { logger } from 'hono/logger';

import { CORS_ORIGINS } from './constants';
import { Home } from './components/home';

import { IsAdmin } from './middlewares/is-admin';
import { Supabase } from './middlewares/supabase';
import { JSonWebToken } from './middlewares/jwt';

import * as ai from './routes/ai';
import * as auth from './routes/auth';
import * as blog from './routes/blog';

import type { JwtVariables } from 'hono/jwt';
import type { TimingVariables } from 'hono/timing';

export type Variables = JwtVariables & TimingVariables;

export interface Env {
  AI: Ai;
}

export type Bindings = {
  AUTH_APP_URL: string;
  AUTH_JWT_SECRET: string;
  AUTH_ADMIN_EMAIL: string;

  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;

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
    allowMethods: ['HEAD', 'POST', 'GET', 'OPTIONS'],
    origin: (origin) => {
      if (CORS_ORIGINS.some((o) => origin.includes(o))) {
        return origin;
      }

      return '.implements.io';
    },
  })
);

app.get('/', async (c) => {
  return c.html(<Home />);
});

// auth
app.use('*', Supabase());

app.get('/auth/oauth', auth.oauth);
app.get('/auth/callback', auth.callback);
app.get('/auth/profile', auth.profile);

// app.get('/auth/info', (c) => {
//   const payload = c.get('jwtPayload');
//   return c.json(payload);
// });

// api
// app.use('/api/*', JSonWebToken());

// ai
app.use('/ai/*', IsAdmin());
app.post('/ai/chat', ai.chat);
app.post('/ai/text2image', ai.text2image);

// blog
app.get('/blog/category/list', blog.listCategory);

app.get('/blog/post/list', blog.listPost);
app.post('/blog/post/create', blog.createPost);
app.post('/blog/post/delete', blog.deletePost);

app.post('/blog/comment/create', blog.createComment);
app.post('/blog/comment/delete', blog.deleteComment);

export default app;
