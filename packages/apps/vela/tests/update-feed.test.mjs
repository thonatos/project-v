import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createReleaseManifest } from '../scripts/release/release-manifest.mjs';
import {
  compareBuild,
  createAppcast,
  feedBuild,
  inspectRelease,
  signArchive,
} from '../scripts/release/update-feed.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const temporary = fs.mkdtempSync(path.join(ROOT, '.tmp/update-feed-'));
const TEST_KEY = path.join(ROOT, 'tests/fixtures/sparkle/test-ed25519-private-key.txt');
const WRONG_KEY = path.join(ROOT, 'tests/fixtures/sparkle/wrong-ed25519-private-key.txt');

function makeRelease({ version = '0.3.0', build = '3', id = 'io.implements.vela.macos' } = {}) {
  const directory = fs.mkdtempSync(path.join(temporary, 'release-'));
  const app = path.join(directory, 'source/Vela.app/Contents');
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(
    path.join(app, 'Info.plist'),
    `<?xml version="1.0"?><plist><dict><key>CFBundleIdentifier</key><string>${id}</string><key>CFBundleShortVersionString</key><string>${version}</string><key>CFBundleVersion</key><string>${build}</string><key>LSMinimumSystemVersion</key><string>14.0</string></dict></plist>`,
  );
  const file = `Vela-Desktop-${version}-macos-arm64.zip`;
  execFileSync('ditto', [
    '-c',
    '-k',
    '--keepParent',
    path.join(directory, 'source/Vela.app'),
    path.join(directory, file),
  ]);
  const descriptor = {
    schemaVersion: 1,
    product: 'vela',
    version,
    tag: `vela-v${version}`,
    commit: 'a'.repeat(40),
    protocolVersion: 1,
    artifacts: [
      {
        component: 'desktop',
        platform: 'macos',
        architecture: 'arm64',
        format: 'zip',
        capabilities: ['access'],
        file,
        size: 0,
        sha256: '0'.repeat(64),
        minimumSystemVersion: '14.0',
        signing: 'adhoc',
        notarized: false,
      },
    ],
  };
  const manifest = createReleaseManifest(descriptor, directory);
  fs.writeFileSync(path.join(directory, 'release.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, 'release-notes.md'), '更新说明\n');
  return directory;
}

try {
  const directory = makeRelease();
  const release = inspectRelease({ releaseDirectory: directory, expectedTag: 'vela-v0.3.0', previousBuild: 2 });
  assert.equal(release.build, '3');
  assert.equal(release.artifact.size, fs.statSync(release.archive).size);
  assert.throws(
    () => inspectRelease({ releaseDirectory: directory, expectedTag: 'vela-v0.3.0', previousBuild: 3 }),
    /不高于/,
  );
  assert.throws(
    () => inspectRelease({ releaseDirectory: makeRelease({ id: 'io.example.evil' }), expectedTag: 'vela-v0.3.0' }),
    /bundle id/,
  );
  assert.throws(
    () => inspectRelease({ releaseDirectory: makeRelease({ version: '0.3.1' }), expectedTag: 'vela-v0.3.0' }),
    /Release tag/,
  );
  assert.equal(compareBuild(4, 3), 1);

  const fakeSign = path.join(temporary, 'sign_update');
  fs.writeFileSync(
    fakeSign,
    `#!/bin/sh\ncat >/dev/null\nif test "$1" = --verify; then exit 0; fi\nsize=$(stat -f '%z' "$3")\necho 'sparkle:edSignature="fixture-signature" length="'$size'"'\n`,
    { mode: 0o755 },
  );
  const signature = signArchive({ signTool: fakeSign, archive: release.archive, privateKey: 'fixture-key' });
  const xml = createAppcast({
    release,
    signature,
    downloadUrl: 'https://github.test/release/Vela.zip',
    notesUrl: 'https://github.test/release/notes.md',
    publishedAt: '2026-10-27T00:00:00Z',
  });
  assert.equal(feedBuild(xml), 3);
  assert.match(xml, /sparkle:edSignature="fixture-signature"/);
  assert.doesNotThrow(() =>
    createAppcast({
      release,
      signature,
      downloadUrl: 'http://127.0.0.1:9000/Vela.zip',
      notesUrl: 'http://localhost:9000/notes.md',
      publishedAt: '2026-10-27',
    }),
  );
  assert.throws(
    () =>
      createAppcast({
        release,
        signature,
        downloadUrl: 'http://example.test/Vela.zip',
        notesUrl: 'https://example.test/notes.md',
        publishedAt: '2026-10-27',
      }),
    /必须使用 HTTPS/,
  );
  assert.throws(
    () =>
      createAppcast({
        release,
        signature: { ...signature, length: 1 },
        downloadUrl: 'https://a',
        notesUrl: 'https://b',
        publishedAt: '2026-10-27',
      }),
    /长度/,
  );
  assert.throws(() => signArchive({ signTool: fakeSign, archive: release.archive, privateKey: '' }), /私钥/);

  if (process.env.SPARKLE_HOME) {
    const realSign = path.join(process.env.SPARKLE_HOME, 'bin/sign_update');
    const key = fs.readFileSync(TEST_KEY, 'utf8');
    const signed = signArchive({ signTool: realSign, archive: release.archive, privateKey: key });
    execFileSync(realSign, ['--verify', '--ed-key-file', TEST_KEY, release.archive, signed.signature]);
    const wrong = spawnSync(realSign, ['--verify', '--ed-key-file', WRONG_KEY, release.archive, signed.signature], {
      encoding: 'utf8',
    });
    assert.notEqual(wrong.status, 0);
    assert.match(wrong.stdout, /failed to pass signing verification/);
    const tampered = path.join(temporary, 'tampered.zip');
    fs.copyFileSync(release.archive, tampered);
    fs.appendFileSync(tampered, 'tampered');
    const changed = spawnSync(realSign, ['--verify', '--ed-key-file', TEST_KEY, tampered, signed.signature], {
      encoding: 'utf8',
    });
    assert.notEqual(changed.status, 0);
    assert.match(changed.stdout, /failed to pass signing verification/);
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('Vela stable appcast assembly and validation passed');
