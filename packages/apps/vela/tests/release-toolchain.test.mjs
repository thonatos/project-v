import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyArchiveDigest, verifyRequiredPaths } from '../scripts/release/archive-contract.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VERSION_CHECK = path.join(ROOT, 'scripts/release/check-version.mjs');
const TOOLCHAIN_CHECK = path.join(ROOT, 'scripts/release/check-toolchain.mjs');
const PREPARE = path.join(ROOT, 'scripts/release/prepare-ci-toolchain.sh');
const FIXTURES = path.join(ROOT, 'tests/fixtures/release-version');
const CURRENT_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const TOOLCHAIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/release/toolchain.json'), 'utf8'));
const TEST_KEY = path.join(ROOT, 'tests/fixtures/sparkle/test-ed25519-private-key.txt');
const REPO_ROOT = path.resolve(ROOT, '../../..');

function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', ...options });
}

const consistent = run(process.execPath, [VERSION_CHECK, '--fixture', path.join(FIXTURES, 'consistent.json')]);
assert.equal(consistent.status, 0, consistent.stderr);
assert.match(consistent.stdout, /0\.1\.0/);

const actual = run(process.execPath, [VERSION_CHECK, '--tag', `vela-v${CURRENT_VERSION}`]);
assert.equal(actual.status, 0, actual.stderr);
assert.match(actual.stdout, /8 个来源/);

const drift = run(process.execPath, [VERSION_CHECK, '--fixture', path.join(FIXTURES, 'drift.json')]);
assert.notEqual(drift.status, 0, '漂移 fixture 必须被拒绝');
assert.match(drift.stderr, /macos\/ui\/nsh\.json: 0\.2\.0/);
assert.match(drift.stderr, /ios\/app\/Vela\/Info\.plist: 0\.3\.0/);

const malformedTag = run(process.execPath, [VERSION_CHECK, '--tag', 'v0.1.0']);
assert.notEqual(malformedTag.status, 0, '非 vela-vX.Y.Z tag 必须被拒绝');
assert.match(malformedTag.stderr, /tag: v0\.1\.0/);

const toolchain = run(process.execPath, [TOOLCHAIN_CHECK]);
assert.equal(toolchain.status, 0, toolchain.stderr);
assert.match(toolchain.stdout, /与项目配置一致/);
assert.equal(TOOLCHAIN.sparkle.version, '2.10.1');
assert.equal(TOOLCHAIN.sparkle.archive.sha256, '1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27');
assert.ok(TOOLCHAIN.sparkle.requiredPaths.includes('bin/sign_update'));
assert.equal(
  Buffer.from(fs.readFileSync(TEST_KEY, 'utf8').trim(), 'base64').length,
  32,
  '测试 key 必须是 Ed25519 seed',
);
assert.equal(
  new Set(Buffer.from(fs.readFileSync(TEST_KEY, 'utf8').trim(), 'base64')).size,
  1,
  '测试 key 必须明显非生产随机密钥',
);
for (const relative of [
  '.github/workflows/vela-ci.yml',
  '.github/workflows/vela-release.yml',
  '.github/actions/vela/setup-toolchain/action.yml',
]) {
  const source = fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');
  assert.doesNotMatch(source, /SPARKLE_PRIVATE_KEY|VELA_UPDATE_PRIVATE_KEY|secrets\./, `${relative} 不得读取更新私钥`);
}

// A locally supplied archive models a compromised download/cache. Its nsh
// payload would create a marker if executed; the declared SHA must reject the
// archive before extraction or execution.
const testTemporaryRoot = fileURLToPath(new URL('.tmp/', import.meta.url));
fs.mkdirSync(testTemporaryRoot, { recursive: true });
const temporary = fs.mkdtempSync(path.join(testTemporaryRoot, 'vela-release-toolchain-'));
try {
  const payload = path.join(temporary, 'payload/nsh/bin');
  const marker = path.join(temporary, 'unverified-nsh-ran');
  const archive = path.join(temporary, 'nsh-macos-arm64.tar.gz');
  const install = path.join(temporary, 'install');
  fs.mkdirSync(payload, { recursive: true });
  fs.writeFileSync(path.join(payload, 'nsh'), `#!/bin/sh\ntouch ${JSON.stringify(marker)}\necho 'nsh 0.2.0'\n`, {
    mode: 0o755,
  });
  const packed = run('tar', ['-czf', archive, '-C', path.join(temporary, 'payload'), '.']);
  assert.equal(packed.status, 0, packed.stderr);

  assert.throws(() => verifyArchiveDigest(archive, TOOLCHAIN.nsh.archive.sha256, 'NSH'), /NSH 归档 SHA-256 摘要不匹配/);
  assert.equal(fs.existsSync(marker), false, '未验证的 nsh 不得执行');
  assert.equal(fs.existsSync(path.join(install, 'nsh')), false, '未验证的归档不得解压');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

const sparkleTemporary = fs.mkdtempSync(path.join(testTemporaryRoot, 'vela-sparkle-toolchain-'));
try {
  const payload = path.join(sparkleTemporary, 'payload/bin');
  const archive = path.join(sparkleTemporary, 'Sparkle-2.10.1.tar.xz');
  const nshArchive = path.join(sparkleTemporary, 'nsh-macos-arm64.tar.gz');
  const install = path.join(sparkleTemporary, 'install');
  fs.mkdirSync(payload, { recursive: true });
  fs.writeFileSync(path.join(payload, 'sign_update'), '#!/bin/sh\nexit 99\n', { mode: 0o755 });
  const packed = run('tar', ['-cJf', archive, '-C', path.join(sparkleTemporary, 'payload'), '.']);
  assert.equal(packed.status, 0, packed.stderr);
  fs.writeFileSync(nshArchive, 'not used');
  assert.throws(
    () => verifyArchiveDigest(archive, TOOLCHAIN.sparkle.archive.sha256, 'Sparkle'),
    /Sparkle 归档 SHA-256 摘要不匹配/,
  );
  assert.equal(fs.existsSync(path.join(install, 'sparkle')), false, '未验证的 Sparkle 归档不得解压');
  assert.throws(
    () => verifyRequiredPaths(path.join(sparkleTemporary, 'payload'), TOOLCHAIN.sparkle.requiredPaths, 'Sparkle'),
    /缺少安全路径/,
  );
} finally {
  fs.rmSync(sparkleTemporary, { recursive: true, force: true });
}

console.log('Vela 发布版本与工具链契约测试通过');
