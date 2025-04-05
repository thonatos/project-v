import { MiddlewareHandler } from 'hono';
import { jwt } from 'hono/jwt';

export const JSonWebToken = (): MiddlewareHandler => {
  return async (c, next) => {
    const jwtMiddleware = jwt({
      secret: c.env.AUTH_JWT_SECRET || 'secret',
    });
    return jwtMiddleware(c, next);
  };
};
