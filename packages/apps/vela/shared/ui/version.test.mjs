import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_VERSION } from './version.ts';

const appRoot = new URL('../../', import.meta.url);
const read = (relative) => fs.readFileSync(new URL(relative, appRoot), 'utf8');
const plistValue = (relative, key) => {
  const match = read(relative).match(new RegExp(`<key>\\s*${key}\\s*</key>\\s*<string>\\s*([^<\\s]+)\\s*</string>`));
  assert.ok(match, `${relative} must define ${key}`);
  return match[1];
};

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

assert.equal(JSON.parse(read('package.json')).version, APP_VERSION, 'package.json version must match the app version');
assert.equal(plistValue('macos/app/Info.plist', 'CFBundleShortVersionString'), APP_VERSION);
assert.equal(plistValue('ios/app/Vela/Info.plist', 'CFBundleShortVersionString'), APP_VERSION);

const manifests = ['macos', 'ios'].map((platform) => JSON.parse(read(`${platform}/ui/nsh.json`)));
const build = String(manifests[0].build);
assert.ok(/^\d+$/.test(build) && Number(build) > 0, 'the Apple build number must be a positive integer');
assert.equal(String(manifests[1].build), build, 'both NSH manifests must use the same build number');
assert.equal(plistValue('macos/app/Info.plist', 'CFBundleVersion'), build);
assert.equal(plistValue('ios/app/Vela/Info.plist', 'CFBundleVersion'), build);

const project = read('ios/app/Vela.xcodeproj/project.pbxproj');
for (const value of project.matchAll(/\bMARKETING_VERSION\s*=\s*([^;\s]+)\s*;/g)) assert.equal(value[1], APP_VERSION);
for (const value of project.matchAll(/\bCURRENT_PROJECT_VERSION\s*=\s*([^;\s]+)\s*;/g)) assert.equal(value[1], build);

console.log(`Vela application version ${APP_VERSION} (${build}) matches all production metadata`);
