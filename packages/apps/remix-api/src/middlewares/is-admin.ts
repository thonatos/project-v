import { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const IsAdmin = (): MiddlewareHandler => {
  return async (c, next) => {
    const payload = c.get('jwtPayload');
    const authAdminEmail = c.env.AUTH_ADMIN_EMAIL;

    if (payload?.email !== authAdminEmail) {
      throw new HTTPException(401, { message: 'unauthorized' });
    }
    await next();
  };
};
