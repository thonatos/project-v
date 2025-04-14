import { MiddlewareHandler } from 'hono';
import { setCookie } from 'hono/cookie';

import { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';

declare module 'hono' {
  interface ContextVariableMap {
    supabase: SupabaseClient;
  }
}

export const SupabaseMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const supabaseUrl = c.env.SUPABASE_URL || '';
    // const supabaseAnonKey = c.env.SUPABASE_ANON_KEY || '';
    // const supabaseServiceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY || '';
    // const supabaseKey = c.env.SUPABASE_ANON_KEY || '';
    const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL missing!');
    }

    if (!supabaseKey) {
      throw new Error('SUPABASE_KEY missing!');
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return parseCookieHeader(c.req.header('Cookie') ?? '') as any;
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            setCookie(c, name, value, options as any);
          });
        },
      },
    });

    c.set('supabase', supabase);

    await next();
  };
};
