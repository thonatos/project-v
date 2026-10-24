import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_VERSION } from './version.ts';

// Both clients ship the same version; the manifests are what the packaging
// scripts read, so the constant is checked against them rather than the other
// way around.
for (const platform of ['macos', 'ios']) {
  const manifest = JSON.parse(fs.readFileSync(new URL(`../../${platform}/ui/nsh.json`, import.meta.url), 'utf8'));
  assert.equal(
    manifest.version,
    APP_VERSION,
    `${platform}/ui/nsh.json version ${manifest.version} must match shared/ui/version.ts (${APP_VERSION})`,
  );
}

console.log(`Vela application version ${APP_VERSION} matches both client manifests`);
