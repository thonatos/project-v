import { redirect } from 'react-router';

import { logout, getUserId } from '~/lib/auth.server';

import type { Route } from './+types/logout';

export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (!userId) throw redirect('/login');
  throw redirect('/');
}
