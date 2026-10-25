import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VELA_ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO_ROOT = path.resolve(VELA_ROOT, '../../..');
const readRepo = (relative) => fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');
const ci = readRepo('.github/workflows/vela-ci.yml');
const release = readRepo('.github/workflows/vela-release.yml');
const setup = readRepo('.github/actions/vela/setup-toolchain/action.yml');
const build = readRepo('.github/actions/vela/build-macos/action.yml');

function job(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`^  ${escaped}:\\n([\\s\\S]*?)(?=^  [a-z][a-z0-9-]*:\\n|(?![\\s\\S]))`, 'm'));
  assert.ok(match, `workflow must define job ${name}`);
  return match[0];
}

function assertOrdered(source, labels) {
  let cursor = -1;
  for (const label of labels) {
    const next = source.indexOf(label, cursor + 1);
    assert.ok(next > cursor, `expected ${label} after the preceding step`);
    cursor = next;
  }
}

for (const [name, source, requireActions] of [
  ['vela-ci.yml', ci, true],
  ['vela-release.yml', release, true],
  ['setup-toolchain/action.yml', setup, true],
  ['build-macos/action.yml', build, false],
]) {
  const uses = [...source.matchAll(/^\s*uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
  if (requireActions) assert.ok(uses.length > 0, `${name} must use actions`);
  for (const action of uses) {
    assert.match(
      action,
      /^(?:\.\/\.github\/actions\/vela\/[\w-]+|[\w.-]+\/[\w.-]+@[0-9a-f]{40})$/,
      `${name}: action must be a local Vela action or pinned to a full commit SHA: ${action}`,
    );
  }
  assert.doesNotMatch(source, /\b(?:macos|ubuntu|windows)-latest\b/, `${name} must not use a floating runner label`);
}

for (const trigger of ['push:', 'pull_request:', "branches: ['main']"]) {
  assert.ok(ci.includes(trigger), `Vela CI must include ${trigger}`);
}
for (const watchedPath of [
  "'packages/apps/vela/**'",
  "'package.json'",
  "'pnpm-lock.yaml'",
  "'pnpm-workspace.yaml'",
  "'.github/workflows/vela-ci.yml'",
  "'.github/workflows/vela-release.yml'",
  "'.github/actions/vela/**'",
]) {
  assert.ok(ci.includes(watchedPath), `Vela CI must watch ${watchedPath}`);
}
assert.match(ci, /group: vela-ci-.*\$\{\{ github\.ref \}\}/);
assert.match(ci, /cancel-in-progress: true/);
assert.match(ci, /^permissions:\n  contents: read$/m);
assert.doesNotMatch(ci, /\b(?:id-token|attestations):\s*write\b/);
assert.doesNotMatch(ci, /\bsecrets\./);

const ciMacos = job(ci, 'verify-macos');
assert.match(ciMacos, /runs-on: xcode-27/);
assert.doesNotMatch(ciMacos, /\bmatrix:/);
assert.match(ciMacos, /permissions:\n      contents: read/);
assert.match(ciMacos, /uses: \.\/\.github\/actions\/vela\/setup-toolchain/);
assert.match(ciMacos, /uses: \.\/\.github\/actions\/vela\/build-macos/);
assert.match(ciMacos, /name: Upload non-release CI ZIP[\s\S]*retention-days: 3/);
assert.match(
  ciMacos,
  /name: Upload redacted failure diagnostics[\s\S]*if: \$\{\{ failure\(\) \}\}[\s\S]*retention-days: 3/,
);

assert.match(setup, /actions\/setup-node@[0-9a-f]{40}/);
assert.match(setup, /actions\/setup-go@[0-9a-f]{40}/);
assert.match(setup, /actions\/cache@[0-9a-f]{40}/);
assertOrdered(setup, [
  'actions/cache@',
  'scripts/release/prepare-ci-toolchain.sh',
  'scripts/release/check-toolchain.mjs',
]);
assert.match(setup, /nsh-a189be8537422a147131c88d7fd39d73265a6aebfbb530287c36a393ff3953fc-/);
assert.match(setup, /xcodebuild -version/);

assertOrdered(build, [
  'scripts/verify-common.sh',
  'scripts/verify-macos.sh',
  'scripts/build-app.sh',
  'scripts/release/macos-check-app.sh',
  'scripts/release/macos-smoke-app.sh',
  'scripts/release/macos-package-app.sh',
  'scripts/release/create-macos-builder.mjs',
]);
for (const action of [setup, build]) {
  assert.doesNotMatch(
    action,
    /^\s+(?:runs-on|permissions|timeout-minutes):/m,
    'composite actions must not use job-only keys',
  );
}

assert.match(release, /^on:\n  push:\n    tags:\n      - 'vela-v\*'$/m);
assert.doesNotMatch(release, /workflow_dispatch:/);
assert.match(release, /^permissions: \{\}$/m);
assert.doesNotMatch(release, /\bmatrix:/, 'platform builders must be separate jobs, not an OS matrix');
for (const name of ['prepare', 'build-macos-desktop', 'assemble', 'attest', 'publish']) job(release, name);
assert.match(job(release, 'build-macos-desktop'), /needs: prepare/);
assert.match(job(release, 'assemble'), /needs: \[prepare, build-macos-desktop\]/);
assert.match(job(release, 'attest'), /needs: assemble/);
assert.match(job(release, 'publish'), /needs: \[prepare, attest\]/);
assert.match(release, /Future Linux support is a separate build-linux-node job/);

const prepare = job(release, 'prepare');
assertOrdered(prepare, ['Reject malformed release tags', 'scripts/release/check-version.mjs']);
assert.match(prepare, /\^vela-v\(0\|\[1-9\]\[0-9\]\*\)/);
assert.match(prepare, /permissions:\n      contents: read/);

const builder = job(release, 'build-macos-desktop');
assert.match(builder, /runs-on: xcode-27/);
assert.match(builder, /permissions:\n      contents: read/);
assert.match(builder, /uses: \.\/\.github\/actions\/vela\/setup-toolchain/);
assert.match(builder, /uses: \.\/\.github\/actions\/vela\/build-macos/);
assert.match(builder, /scripts\/release\/check-version\.mjs --tag/);
assert.match(builder, /platform-output:/);

const assemble = job(release, 'assemble');
assert.match(assemble, /permissions:\n      contents: read/);
assert.match(assemble, /scripts\/release\/assemble-release\.mjs/);
assert.match(assemble, /find .*vela-platforms.*-name release\.json/, 'assemble must discover every platform builder');
for (const asset of ['Vela-*', 'SHA256SUMS', 'release.json', 'release-notes.md']) {
  assert.ok(assemble.includes(asset), `assemble must upload ${asset}`);
}

const attest = job(release, 'attest');
assert.match(attest, /permissions:\n      contents: read\n      id-token: write\n      attestations: write/);
assert.match(attest, /actions\/attest@[0-9a-f]{40}/);
assert.match(attest, /subject-path: .*\/Vela-\*/);
assert.doesNotMatch(attest, /actions\/checkout@/);

const publish = job(release, 'publish');
assert.match(publish, /permissions:\n      contents: write/);
assert.doesNotMatch(publish, /(?:contents: read|id-token:|attestations:)/);
assert.doesNotMatch(publish, /actions\/checkout@/);
assert.doesNotMatch(publish, /packages\/apps\/vela|\bscripts\//, 'publish must not execute repository code');
assert.match(publish, /GH_TOKEN: \$\{\{ github\.token \}\}/, 'GitHub token must be passed to gh as an opaque string');
assert.doesNotMatch(
  publish,
  /GH_TOKEN.*(?:cut|slice|substr|substring|grep|sed|awk)|ghs_\[[^\]]+\]\{\d+\}/,
  'GitHub installation tokens must not be inspected, truncated, or validated by length',
);
assert.match(publish, /Refusing to overwrite published release/);
assert.match(publish, /gh release create[\s\S]*--draft --prerelease/);
assert.match(publish, /gh release upload[\s\S]*--clobber/);
assert.match(publish, /gh release (?:create|upload)[\s\S]*release-notes\.md/);

console.log(
  'Vela release workflow policy passed: thin workflows, pinned actions, ordered steps, permissions, caches, assets, and draft publishing are constrained',
);
