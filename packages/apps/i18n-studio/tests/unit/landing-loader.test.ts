import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setupTestDbFromTemplate, type TestEnv } from '../test-db';

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

describe('landing _index loader', () => {
  let env: TestEnv;
  let loader: (args: LoaderArgs) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    env = setupTestDbFromTemplate();
    const mod = (await import('~/routes/_index')) as unknown as {
      loader: (args: LoaderArgs) => Promise<unknown>;
    };
    loader = mod.loader;
  });

  afterEach(() => env.cleanup());

  it('匿名访问返回 user=null', async () => {
    const data = (await loader(mkArgs('http://localhost/'))) as {
      user: unknown;
      theme: unknown;
    };
    expect(data).toBeTruthy();
    expect(data.user).toBeNull();
    expect(data.theme).toBeDefined();
  });

  it('loader 不抛 redirect (即不要求登录)', async () => {
    let threw: unknown = null;
    try {
      await loader(mkArgs('http://localhost/'));
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeNull();
  });
});
