import { Context, Next } from 'hono';
import { jwt } from 'hono/jwt';

export const apiJwt = async (c: Context, next: Next) => {
  const jwtMiddleware = jwt({
    secret: c.env.AUTH_JWT_SECRET || 'secret',
  });
  return jwtMiddleware(c, next);
};
