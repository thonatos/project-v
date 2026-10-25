import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(`scripts/${name}`, root), 'utf8');

const expected = new Set([
  'documentation',
  'go-race',
  'ios-deps',
  'ios-nsh-check',
  'ios-projections',
  'ios-rust-check',
  'ios-signing',
  'ios-structure',
  'ios-theme',
  'macos-layout',
  'macos-nsh-check',
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

console.log(`Vela verification gates cover ${actual.size} checks exactly once`);
