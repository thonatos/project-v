import { data } from 'react-router';

import { createLangCookie, isLang } from '~/lib/i18n.server';

import type { Route } from './+types/api.lang';

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
    body = { lang: form.get('lang') };
  }

  const lang = (body as { lang?: unknown } | null)?.lang;
  if (!isLang(lang)) {
    return data({ ok: false, error: 'invalid_lang' }, { status: 400 });
  }

  return data({ ok: true, lang }, { headers: { 'Set-Cookie': createLangCookie(lang) } });
}

export function loader() {
  return data({ ok: false, error: 'method_not_allowed' }, { status: 405 });
}
