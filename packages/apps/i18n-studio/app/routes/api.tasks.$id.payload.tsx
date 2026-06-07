import { requireApiToken } from '~/lib/api-token.server';
import { getPayload } from '~/lib/services/task.server';
import { jsonOk, handleError } from '~/lib/api.server';

import type { Route } from './+types/api.tasks.$id.payload';

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    requireApiToken(request, 'task');
    return jsonOk(getPayload(params.id!));
  } catch (e) {
    return handleError(e);
  }
}
