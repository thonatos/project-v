import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(`scripts/${name}`, root), 'utf8');
const repoRoot = path.resolve(fileURLToPath(root), '../../..');

const expected = new Set([
  'documentation',
  'capabilities',
  'go-race',
  'ios-deps',
  'ios-nsh-check',
  'ios-overlay-headless',
  'ios-projections',
  'ios-rust-check',
  'ios-signing',
  'ios-structure',
  'ios-theme',
  'macos-layout',
  'macos-nsh-check',
  'macos-shell-smoke',
  'macos-semantics',
  'macos-release-contract',
  'macos-theme',
  'network-isolation',
  'protocol-docs',
  'release-manifest',
  'release-toolchain',
  'release-workflows',
  'rust-clippy',
  'rust-format',
  'rust-test',
  'shared-flows',
  'shared-clipboard',
  'shared-operations',
  'shared-hostname',
  'shared-projections',
  'shared-version',
  'structure',
  'verify-gates',
]);

const gates = ['verify-common.sh', 'verify-macos.sh', 'verify-ios.sh'];
const actual = new Set(
  gates.flatMap((gate) => [...read(gate).matchAll(/^run ([a-z0-9-]+) /gm)].map((match) => match[1])),
);

assert.deepEqual([...actual].sort(), [...expected].sort(), 'the split gates must retain every aggregate verification');
assert.equal(actual.size, expected.size, 'a verification name must belong to exactly one gate');

const aggregate = read('verify.sh');
for (const gate of gates) {
  assert.match(aggregate, new RegExp(`scripts/${gate.replace('.', '\\.')}`), `verify.sh must compose ${gate}`);
}

const release = read('verify-release.sh');
const acceptance = read('verify-ios-acceptance.sh');
for (const [name, source] of [
  ...gates.map((gate) => [gate, read(gate)]),
  ['verify.sh', aggregate],
  ['verify-release.sh', release],
]) {
  assert.doesNotMatch(source, /--target ios|verify-ios-acceptance/, `${name} must not start iOS Simulator implicitly`);
}
assert.match(acceptance, /--target ios/, 'the explicit acceptance entry owns iOS Simulator target tests');
assert.match(acceptance, /CI:-.*true/, 'the local Simulator entry must refuse CI');
assert.doesNotMatch(
  acceptance,
  /openspec|completedTasks|archived/,
  'Simulator tooling must not infer OpenSpec lifecycle state',
);

for (const [name, source] of [
  ['vela-ci.yml', fs.readFileSync(path.join(repoRoot, '.github/workflows/vela-ci.yml'), 'utf8')],
  ['vela-release.yml', fs.readFileSync(path.join(repoRoot, '.github/workflows/vela-release.yml'), 'utf8')],
  [
    'build-macos/action.yml',
    fs.readFileSync(path.join(repoRoot, '.github/actions/vela/build-macos/action.yml'), 'utf8'),
  ],
  [
    'setup-toolchain/action.yml',
    fs.readFileSync(path.join(repoRoot, '.github/actions/vela/setup-toolchain/action.yml'), 'utf8'),
  ],
]) {
  assert.doesNotMatch(
    source,
    /--target ios|simctl\s+boot|platform=iOS Simulator|verify(?::|-)ios-acceptance/,
    `${name} must remain GitHub Actions-compatible without an iOS Simulator`,
  );
}

console.log(`Vela default verification gates cover ${actual.size} checks without starting iOS Simulator`);
