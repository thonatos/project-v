import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'vite-plus/test';

const packageRoot = path.resolve(import.meta.dirname, '..');
const entry = path.join(packageRoot, 'src/main.ts');

interface RunOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly input?: string;
}

function run(args: readonly string[], options: RunOptions = {}) {
  return spawnSync(process.execPath, [entry, ...args], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    input: options.input,
  });
}

async function temporaryHome(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'gpm-test-'));
}

test('help and version write stable output to stdout', () => {
  const help = run(['help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /gpm init/);
  assert.equal(help.stderr, '');

  const version = run(['version']);
  assert.equal(version.status, 0);
  assert.equal(version.stdout, 'gpm 0.1.0\n');
  assert.equal(version.stderr, '');
});

test('unknown commands and missing clone URL exit with usage errors', () => {
  const unknown = run(['wat']);
  assert.equal(unknown.status, 2);
  assert.equal(unknown.stdout, '');
  assert.match(unknown.stderr, /unknown command/);

  const missing = run(['clone']);
  assert.equal(missing.status, 2);
  assert.equal(missing.stdout, '');
  assert.match(missing.stderr, /gpm clone <repository-url>/);
});

test('init writes one absolute root and does not overwrite config', async () => {
  const home = await temporaryHome();
  const first = run(['init'], { env: { HOME: home } });
  assert.equal(first.status, 0);
  assert.equal(first.stdout, '');
  assert.match(first.stderr, /Initialized successfully/);

  const configPath = path.join(home, '.gpmrc');
  const expected = `${JSON.stringify({ root: [path.join(home, 'gpm')] })}\n`;
  assert.equal(await readFile(configPath, 'utf8'), expected);

  const second = run(['init'], { env: { HOME: home } });
  assert.equal(second.status, 1);
  assert.match(second.stderr, /config already exists/);
  assert.equal(await readFile(configPath, 'utf8'), expected);
});

test('clone without config fails immediately in a non-interactive process', async () => {
  const home = await temporaryHome();
  const result = run(['clone', 'https://github.com/owner/repository.git'], { env: { HOME: home } });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /run "gpm init" first/);
});

test('clone validates config before invoking git', async () => {
  const home = await temporaryHome();
  await writeFile(path.join(home, '.gpmrc'), '{"root":["relative"]}\n');
  const result = run(['clone', 'https://github.com/owner/repository.git'], { env: { HOME: home } });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /non-empty absolute path/);
});

test('clone passes exact arguments to git and reserves stdout for destination', async () => {
  const home = await temporaryHome();
  const root = path.join(home, 'workspace');
  const bin = path.join(home, 'bin');
  const argsFile = path.join(home, 'git-args');
  await mkdir(bin);
  await writeFile(path.join(home, '.gpmrc'), `${JSON.stringify({ root: [root] })}\n`);
  const git = path.join(bin, 'git');
  await writeFile(
    git,
    `#!/bin/sh\nprintf '%s\\n' "$@" > "$GPM_ARGS_FILE"\nprintf 'git stdout\\n'\nprintf 'git stderr\\n' >&2\n`,
  );
  await chmod(git, 0o755);

  const repositoryUrl = 'https://github.com/thonatos/project-v.git';
  const result = run(['clone', repositoryUrl], {
    env: { HOME: home, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`, GPM_ARGS_FILE: argsFile },
  });
  const destination = path.join(root, 'github.com', 'thonatos', 'project-v');

  assert.equal(result.status, 0);
  assert.equal(result.stdout, `${destination}\n`);
  assert.match(result.stderr, /git stdout/);
  assert.match(result.stderr, /git stderr/);
  assert.match(result.stderr, new RegExp(destination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.deepEqual((await readFile(argsFile, 'utf8')).trim().split('\n'), ['clone', repositoryUrl, destination]);
});

test('clone returns git failures and preserves files left at destination', async () => {
  const home = await temporaryHome();
  const root = path.join(home, 'workspace');
  const bin = path.join(home, 'bin');
  await mkdir(bin);
  await writeFile(path.join(home, '.gpmrc'), `${JSON.stringify({ root: [root] })}\n`);
  const git = path.join(bin, 'git');
  await writeFile(
    git,
    `#!/bin/sh\nmkdir -p "$3"\nprintf 'partial' > "$3/partial"\nprintf 'clone failed\\n' >&2\nexit 42\n`,
  );
  await chmod(git, 0o755);

  const result = run(['clone', 'git@github.com:owner/repository.git'], {
    env: { HOME: home, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` },
  });
  const partial = path.join(root, 'github.com', 'owner', 'repository', 'partial');
  assert.equal(result.status, 42);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /clone failed/);
  assert.equal(await readFile(partial, 'utf8'), 'partial');
});

test('clone returns 127 when git is unavailable', async () => {
  const home = await temporaryHome();
  const root = path.join(home, 'workspace');
  const emptyPath = path.join(home, 'empty-bin');
  await mkdir(emptyPath);
  await writeFile(path.join(home, '.gpmrc'), `${JSON.stringify({ root: [root] })}\n`);
  const result = run(['clone', 'https://github.com/owner/repository.git'], {
    env: { HOME: home, PATH: emptyPath },
  });
  assert.equal(result.status, 127);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /git executable was not found/);
});
