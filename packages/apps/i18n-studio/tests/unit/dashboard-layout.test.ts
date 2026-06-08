import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupTestDbFromTemplate, type TestEnv } from '../test-db';
import { bootstrap, seedWorld } from '../helpers';

interface LoaderArgs {
  request: Request;
  params: Record<string, string>;
  context: Record<string, unknown>;
}

function mkArgs(url: string, headers: Record<string, string> = {}): LoaderArgs {
  return {
    request: new Request(url, { headers }),
    params: {},
    context: {},
  };
}

describe('dashboard layout loader', () => {
  let env: TestEnv;
  let loader: (args: LoaderArgs) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    env = setupTestDbFromTemplate();
    const mod = (await import('~/routes/dashboard')) as unknown as {
      loader: (args: LoaderArgs) => Promise<unknown>;
    };
    loader = mod.loader;
  });

  afterEach(() => env.cleanup());

  it('匿名访问 /dashboard 抛 redirect 到 /login', async () => {
    let caught: Response | null = null;
    try {
      await loader(mkArgs('http://localhost/dashboard'));
    } catch (e) {
      if (e instanceof Response) caught = e;
    }
    expect(caught).not.toBeNull();
    expect(caught!.status).toBeGreaterThanOrEqual(300);
    expect(caught!.status).toBeLessThan(400);
    expect(caught!.headers.get('Location')).toBe('/login');
  });

  it('已登录用户的 loader 返回 user / theme,供子路由 outlet ctx 使用', async () => {
    const ctx = await bootstrap(env);
    const world = await seedWorld(ctx);
    const sessionRes = await ctx.api.auth.loginAndCreateSession(world.alice.id);
    const cookie = sessionRes.headers.get('Set-Cookie');
    if (!cookie) throw new Error('expected Set-Cookie header from loginAndCreateSession');

    const data = (await loader(mkArgs('http://localhost/dashboard', { Cookie: cookie }))) as {
      user: { id: string; email: string; isSuperuser: boolean };
      theme: 'light' | 'dark' | 'system';
    };
    expect(data.user).toBeTruthy();
    expect(data.user.id).toBe(world.alice.id);
    expect(data.user.email).toBe(world.alice.email);
    expect(typeof data.user.isSuperuser).toBe('boolean');
    expect(['light', 'dark', 'system']).toContain(data.theme);
  });
});
