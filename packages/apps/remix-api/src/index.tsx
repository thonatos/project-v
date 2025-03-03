import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { timing } from 'hono/timing';
import { logger } from 'hono/logger';

import { CORS_ORIGINS } from './constants';
import { Home } from './components/home';
import { apiJwt } from './middlewares/api-jwt';
import { apiAuth } from './middlewares/api-auth';
import api from './routes/api';

import type { JwtVariables } from 'hono/jwt';
import type { TimingVariables } from 'hono/timing';

export type Variables = JwtVariables & TimingVariables;

export interface Env {
  AI: Ai;
}

export type Bindings = {
  AUTH_JWT_SECRET: string;
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

// api
// middleware
app.use('/api/*', apiJwt);
app.use('/api/*', apiAuth);

// api routes
app.get('/api/info', api.info);
app.get('/api/text2image', api.text2image);
app.post('/api/chat', api.chat);

export default app;
