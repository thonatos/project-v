import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const platform of ['macos', 'ios']) {
  const config = JSON.parse(fs.readFileSync(new URL(`../${platform}/ui/nsh.json`, import.meta.url), 'utf8'));
  assert.equal(config.capabilities.clipboard, true, `${platform} grants clipboard`);
  assert.equal(config.capabilities.network, undefined, `${platform} UI does not need direct network access`);
}

console.log('Vela app capability declarations are minimal');
