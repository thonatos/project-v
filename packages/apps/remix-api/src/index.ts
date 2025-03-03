import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timing, TimingVariables } from 'hono/timing';
import { trimTrailingSlash } from 'hono/trailing-slash';

export type Env = {
  Variables: TimingVariables & {};
  Bindings: {
    AI: Ai;
    // MY_BUCKET: R2Bucket;
  };
};

const app = new Hono<Env>();

app.use(logger());
app.use(timing());
app.use(trimTrailingSlash());

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

export default app;
