import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VERSION_CHECK = path.join(ROOT, 'scripts/release/check-version.mjs');
const TOOLCHAIN_CHECK = path.join(ROOT, 'scripts/release/check-toolchain.mjs');
const PREPARE = path.join(ROOT, 'scripts/release/prepare-ci-toolchain.sh');
const FIXTURES = path.join(ROOT, 'tests/fixtures/release-version');

function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', ...options });
}

const consistent = run(process.execPath, [VERSION_CHECK, '--fixture', path.join(FIXTURES, 'consistent.json')]);
assert.equal(consistent.status, 0, consistent.stderr);
assert.match(consistent.stdout, /0\.1\.0/);

const actual = run(process.execPath, [VERSION_CHECK, '--tag', 'vela-v0.1.0']);
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

  const rejected = run('sh', [PREPARE, install], {
    env: { ...process.env, NSH_ARCHIVE_FILE: archive },
  });
  assert.notEqual(rejected.status, 0, '摘要错误的 NSH 归档必须被拒绝');
  assert.match(rejected.stderr, /SHA-256 摘要不匹配/);
  assert.equal(fs.existsSync(marker), false, '未验证的 nsh 不得执行');
  assert.equal(fs.existsSync(path.join(install, 'nsh')), false, '未验证的归档不得解压');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('Vela 发布版本与工具链契约测试通过');
