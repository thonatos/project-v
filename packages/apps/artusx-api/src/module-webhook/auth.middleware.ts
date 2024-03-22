import { ArtusxContext, ArtusxNext } from '@artusx/core';
import { getEnv } from '@artusx/utils';

const AUTH_TOKEN = getEnv<string>('AUTH_TOKEN', 'string') || '';

export default async function checkAuthToken(ctx: ArtusxContext, next: ArtusxNext): Promise<void> {
  const { token } = ctx.query;

  if (!token || !AUTH_TOKEN || token !== AUTH_TOKEN) {
    ctx.throw(403, 'invalid token');
  }

  await next();
}
