import { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getUserId } from '../util';

declare module 'hono' {
  interface ContextVariableMap {
    user_id: string;
  }
}

type Options = {
  ignore: string[];
};

const isAuthPath = (method: string, pathname: string, ignore: string[]) => {
  if (method === 'OPTIONS') {
    return false;
  }

  if (method !== 'GET') {
    return true;
  }

  const matchIgnore = ignore.some((p) => {
    return pathname === p;
  });

  return !matchIgnore;
};

export const IsLoginMiddleware = (options: Options): MiddlewareHandler => {
  return async (c, next) => {
    const method = c.req.method;
    const pathname = c.req.path;
    const matched = isAuthPath(method, pathname, options.ignore);

    console.log('isAuthPath', { method, pathname, matched });

    if (matched) {
      const user_id = await getUserId(c);
      if (!user_id) {
        throw new HTTPException(403, { message: 'Unauthorized' });
      }

      c.set('user_id', user_id);
    }

    await next();
  };
};
