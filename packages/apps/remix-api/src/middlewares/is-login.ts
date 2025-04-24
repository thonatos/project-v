import { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getUserId } from '../services/user';

declare module 'hono' {
  interface ContextVariableMap {
    user_id: string;
  }
}

type METHOD = 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'OPTIONS';

type Options = Partial<{
  [key in METHOD]: string[];
}>;

const isAuthPath = (method: METHOD, pathname: string, ignore: string[]) => {
  if (method === 'OPTIONS') {
    return false;
  }

  const matchIgnore = ignore.some((ignorePath) => {
    return pathname === ignorePath;
  });

  return !matchIgnore;
};

export const IsLoginMiddleware = (options: Options): MiddlewareHandler => {
  return async (c, next) => {
    const method = c.req.method as METHOD;
    const pathname = c.req.path;
    const ignore = options[method] || [];
    const matched = isAuthPath(method, pathname, ignore);

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
