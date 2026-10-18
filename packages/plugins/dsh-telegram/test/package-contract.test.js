import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'vite-plus/test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import vm from 'node:vm';

import { installModelSelection } from '@deepseek-ai/dsh-agent';
import { defineDomain, descriptorOf, domainTable } from '@deepseek-ai/dsh-storage-domain';

const require = createRequire(import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);
const execFileAsync = promisify(execFile);

test('uses the target dsh public runtime exports', () => {
  assert.equal(typeof installModelSelection, 'function');
  assert.equal(typeof defineDomain, 'function');
  assert.equal(typeof domainTable, 'function');
  assert.equal(typeof descriptorOf, 'function');
});

test('maps the package prerelease suffix to the exact dsh compatibility target', async () => {
  const metadata = JSON.parse(await readFile(packagePath, 'utf8'));
  const suffix = metadata.version.match(/-dsh\.(.+)$/)?.[1];

  assert.ok(suffix, 'package version must carry a dsh compatibility suffix');
  assert.equal(suffix, metadata.engines.dsh);
  assert.equal(metadata.dependencies['@deepseek-ai/dsh-agent'], metadata.engines.dsh);
  assert.equal(metadata.dependencies['@deepseek-ai/dsh-storage-domain'], metadata.engines.dsh);
});

test('resolves every declared dsh client injection package', async () => {
  const metadata = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(metadata.dsh.client.inject.includes('@deepseek-ai/dsh-client-runtime'), false);
  for (const packageName of metadata.dsh.client.inject) {
    const injected = JSON.parse(await readFile(require.resolve(`${packageName}/package.json`), 'utf8'));
    assert.equal(injected.name, packageName);
    assert.match(injected.exports?.['./client']?.default ?? '', /^\.\/lib\/client\.js$/);
  }
});

test('publishes an auditable local-link-only acceptance plan', async () => {
  const script = fileURLToPath(new URL('../scripts/local-acceptance-plan.mjs', import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [script]);
  const plan = JSON.parse(stdout);

  assert.equal(plan.mode, 'local-link-only');
  assert.match(plan.commands.join('\n'), /dsh plugin --profile web link/u);
  assert.match(plan.commands.at(-1), /dsh plugin --profile web unlink/u);
  assert.match(plan.preconditions.join('\n'), /exactly one id: dsh-telegram/u);
  assert.doesNotMatch(plan.commands.join('\n'), /\b(?:npm|pnpm)\s+publish\b/u);
  assert.doesNotMatch(plan.commands.join('\n'), /\bdsh\s+plugin\s+--profile\s+web\s+add\b/u);
});

test('loads the generated client bundle through the dsh ModuleLoader wrapper', async () => {
  const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  let registration;
  const context = {
    window: {
      __ModuleLoader__: {
        load(value) {
          registration = value;
        },
      },
    },
  };
  vm.runInNewContext(bundle, context);
  const loaded = registration.factory((name) => {
    if (name === 'react') return {};
    if (name === 'react-dom') return {};
    throw new Error(`unexpected client external: ${name}`);
  });

  assert.equal(registration.id, '@implementsio/dsh-telegram');
  assert.equal(typeof loaded.apply, 'function');
  assert.deepEqual(Array.from(loaded.inject), ['remote', 'remote.credentials', 'slots', 'workspaces']);
  assert.doesNotMatch(bundle, /settingsScope|settings\.plugin\.item/u);
  assert.match(bundle, /plugins\.row\.config/u);
});
