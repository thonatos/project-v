import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ADMIN_EMAIL } from '../constants';

export const apiAuth = async (c: Context, next: Next) => {
  const payload = c.get('jwtPayload');
  if (payload?.email !== ADMIN_EMAIL) {
    throw new HTTPException(401, { message: 'unauthorized' });
  }
  await next();
};
