import { Context } from 'hono';
import { AI_MODEL } from '../constants';

export const chat = async (c: Context) => {
  const { messages } = await c.req.json<{
    messages: { role: string; content: string }[];
  }>();

  const inputs = {
    stream: true,
    max_tokens: 512,
    messages: [{ role: 'system', content: 'You are a helpful assistant' }, ...messages],
  };

  const stream = await c.env.AI.run(AI_MODEL.DEEPSEEK_AI, inputs);

  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream' },
  });
};

export const text2image = async (c: Context) => {
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
};
