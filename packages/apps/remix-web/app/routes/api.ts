import type { LoaderFunctionArgs } from '@remix-run/node'; // or cloudflare/deno
import { json } from '@remix-run/node'; // or cloudflare/deno

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // console.log(request);
  return json({ success: true }, 200);
};
