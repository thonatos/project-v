import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { cors } from 'hono/cors';
import { timing } from 'hono/timing';
import { logger } from 'hono/logger';
import { css, Style } from 'hono/css';
import { HTTPException } from 'hono/http-exception';

import type { JwtVariables } from 'hono/jwt';
import type { TimingVariables } from 'hono/timing';

const AI_MODEL = {
  DEEPSEEK_AI: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  STABILITY_AI: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
};

const CORS_ORIGINS = ['localhost', 'implements.io'];

export type Variables = JwtVariables & TimingVariables;

export interface Env {
  AI: Ai;
}

export type Bindings = {
  JWT_SECRET: string;
  AI: {
    run: (model: string, inputs: any) => Promise<any>;
  };
};

const headerClass = css`
  padding: 1rem 2rem;
`;

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
  return c.html(
    <html>
      <head>
        <Style />
      </head>
      <body>
        <div className={headerClass}>
          <h2>remix-worker</h2>
          <p>worker for remix-app, powered by cloudflare workers.</p>
        </div>
      </body>
    </html>
  );
});

app.use('/api/*', (c, next) => {
  const jwtMiddleware = jwt({
    secret: c.env.JWT_SECRET || 'it-is-very-secret',
  });
  return jwtMiddleware(c, next);
});

app.use('/api/*', async (c, next) => {
  const payload = c.get('jwtPayload');
  if (payload?.email !== 'thonatos.yang@gmail.com') {
    throw new HTTPException(401, { message: 'unauthorized' });
  }
  await next();
});

app.get('/api/info', (c) => {
  const payload = c.get('jwtPayload');
  // eg: { 'sub': '1234567890', 'name': 'John Doe', 'iat': 1516239022 }
  return c.json(payload);
});

app.post('/api/chat', async (c) => {
  const { messages } = await c.req.json<{
    messages: { role: string; content: string }[];
  }>();

  // console.log('messages', messages);

  const inputs = {
    stream: true,
    max_tokens: 512,
    messages: [{ role: 'system', content: 'You are a helpful assistant' }, ...messages],
  };

  const stream = await c.env.AI.run(AI_MODEL.DEEPSEEK_AI, inputs);

  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream' },
  });
});

app.get('/api/text2image', async (c) => {
  const prompt = c.req.query('prompt');

  if (!prompt) {
    return c.json({ error: 'prompt is required' }, 400);
  }

  const inputs = {
    prompt,
    width: 800,
    height: 400,
  };

  const response = await c.env.AI.run(AI_MODEL.STABILITY_AI, inputs);

  return new Response(response, {
    headers: {
      'content-type': 'image/png',
    },
  });
});

export default app;
