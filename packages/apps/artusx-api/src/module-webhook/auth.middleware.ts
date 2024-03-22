import { ArtusxContext, ArtusxNext } from '@artusx/core';
import { getEnv } from '@artusx/utils';

const WEBHOOK_AUTH_TOKEN = getEnv<string>('WEBHOOK_AUTH_TOKEN', 'string') || '';

export default async function checkAuthToken(ctx: ArtusxContext, next: ArtusxNext): Promise<void> {
  const { token } = ctx.query;

  if (!token || !WEBHOOK_AUTH_TOKEN || token !== WEBHOOK_AUTH_TOKEN) {
    ctx.throw(403, 'invalid token');
  }

  await next();
}
