import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isValidHostname } from './hostname.ts';

const fixture = JSON.parse(
  fs.readFileSync(new URL('../protocol/fixtures/hostname-validation.json', import.meta.url), 'utf8'),
);

assert.ok(fixture.valid.length > 0 && fixture.invalid.length > 0, 'fixture must list both valid and invalid names');
for (const name of fixture.valid) assert.equal(isValidHostname(name), true, `${JSON.stringify(name)} must be accepted`);
for (const name of fixture.invalid)
  assert.equal(isValidHostname(name), false, `${JSON.stringify(name)} must be rejected`);
console.log(`Vela hostname rule matches the shared fixture (${fixture.valid.length + fixture.invalid.length} cases)`);
