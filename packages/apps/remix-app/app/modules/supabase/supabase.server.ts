// import { kv } from '@vercel/kv';
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';

export function createClient(request: Request) {
  const headers = new Headers();

  const supabase = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: {
      autoRefreshToken: false,
      // storage: {
      //   getItem: async(key: string) => {
      //     console.log('get key:', key);
      //     return await kv.get(key);
      //   },
      //   setItem: async(key: string, value: string) => {
      //     console.log('set key:', key);
      //     await kv.set(key, value);
      //   },
      //   removeItem: async(key: string) => {
      //     console.log('remove key:', key);
      //     await kv.del(key);
      //   },
      //   isServer: true,
      // },
      // persistSession: true,
      // detectSessionInUrl: false,
    },
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          headers.append('Set-Cookie', serializeCookieHeader(name, value, options))
        );
      },
    },
  });

  return {
    supabase,
    headers,
  };
}
