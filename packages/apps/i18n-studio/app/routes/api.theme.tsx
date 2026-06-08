import { data } from 'react-router';

import { createThemeCookie, isTheme } from '~/lib/theme.server';

import type { Route } from './+types/api.theme';

export async function action({ request }: Route.ActionArgs) {
  let body: unknown;
  const contentType = request.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      body = await request.json();
    } catch {
      return data({ ok: false, error: 'invalid_json' }, { status: 400 });
    }
  } else {
    const form = await request.formData();
    body = { theme: form.get('theme') };
  }

  const theme = (body as { theme?: unknown } | null)?.theme;
  if (!isTheme(theme)) {
    return data({ ok: false, error: 'invalid_theme' }, { status: 400 });
  }

  return data({ ok: true, theme }, { headers: { 'Set-Cookie': createThemeCookie(theme) } });
}

export function loader() {
  return data({ ok: false, error: 'method_not_allowed' }, { status: 405 });
}
