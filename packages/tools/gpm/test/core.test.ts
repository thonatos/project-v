import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'vite-plus/test';
import { GpmError, getDestination, parseConfig, parseRepository } from '../src/core.ts';

test('parseConfig accepts exactly one absolute root', () => {
  assert.deepEqual(parseConfig('{"root":["/tmp/gpm"]}', '/tmp/.gpmrc'), { root: ['/tmp/gpm'] });
});

for (const [name, source] of [
  ['invalid JSON', '{'],
  ['missing root', '{}'],
  ['empty root array', '{"root":[]}'],
  ['multiple roots', '{"root":["/tmp/a","/tmp/b"]}'],
  ['relative root', '{"root":["gpm"]}'],
  ['home-relative root', '{"root":["~/gpm"]}'],
] as const) {
  test(`parseConfig rejects ${name}`, () => {
    assert.throws(() => parseConfig(source, '/tmp/.gpmrc'), GpmError);
  });
}

for (const [repositoryUrl, host, repositoryPath] of [
  ['https://github.com/thonatos/project-v.git', 'github.com', 'thonatos/project-v'],
  ['http://github.com/thonatos/project-v.git', 'github.com', 'thonatos/project-v'],
  ['git://github.com/thonatos/project-v.git', 'github.com', 'thonatos/project-v'],
  ['ssh://git@github.com/thonatos/project-v.git', 'github.com', 'thonatos/project-v'],
  ['git@github.com:thonatos/project-v.git', 'github.com', 'thonatos/project-v'],
  ['https://gitlab.example.com/team/platform/project.git', 'gitlab.example.com', 'team/platform/project'],
] as const) {
  test(`parseRepository parses ${repositoryUrl}`, () => {
    const repository = parseRepository(repositoryUrl);
    assert.equal(repository.host, host);
    assert.equal(repository.pathSegments.join('/'), repositoryPath);
  });
}

for (const repositoryUrl of [
  'owner/repository',
  '/tmp/repository',
  'file:///tmp/repository',
  'https://github.com/owner',
  'https://github.com/owner/../repository',
  'https://github.com/owner/%2e%2e/repository',
  'https://github.com/owner/repo%2Fescape.git',
]) {
  test(`parseRepository rejects ${repositoryUrl}`, () => {
    assert.throws(
      () => parseRepository(repositoryUrl),
      (error: unknown) => error instanceof GpmError && error.exitCode === 2,
    );
  });
}

test('getDestination creates a deterministic path inside root', () => {
  const repository = parseRepository('git@github.com:thonatos/project-v.git');
  assert.equal(
    getDestination('/Users/example/gpm', repository),
    path.join('/Users/example/gpm/github.com/thonatos/project-v'),
  );
});
