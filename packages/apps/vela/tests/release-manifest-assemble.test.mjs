import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createReleaseManifest,
  serializeReleaseManifest,
  validateReleaseManifest,
} from '../scripts/release/release-manifest.mjs';
import { assembleRelease } from '../scripts/release/assemble-release.mjs';

const FIXTURES = fileURLToPath(new URL('fixtures/release-manifest', import.meta.url));
const temporaryRoots = [];

const testTemporaryRoot = fileURLToPath(new URL('.tmp/', import.meta.url));
fs.mkdirSync(testTemporaryRoot, { recursive: true });

function temporaryDirectory(name) {
  const directory = fs.mkdtempSync(path.join(testTemporaryRoot, `vela-${name}-`));
  temporaryRoots.push(directory);
  return directory;
}

test.after(() => {
  for (const directory of temporaryRoots) fs.rmSync(directory, { recursive: true, force: true });
});

function readDescriptor(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name, 'descriptor.json'), 'utf8'));
}

function prepareBuilder(name) {
  const source = path.join(FIXTURES, name);
  const builder = temporaryDirectory(`builder-${name}`);
  const descriptor = readDescriptor(name);
  for (const artifact of descriptor.artifacts) {
    fs.copyFileSync(path.join(source, artifact.file), path.join(builder, artifact.file));
  }
  const manifest = createReleaseManifest(descriptor, builder);
  fs.writeFileSync(path.join(builder, 'release.json'), serializeReleaseManifest(manifest));
  return { builder, manifest };
}

test('schema version 1 可描述 macOS Desktop 与未来 Linux Node', () => {
  const macos = prepareBuilder('macos');
  const linux = prepareBuilder('linux-node');

  assert.deepEqual(macos.manifest.artifacts[0], {
    component: 'desktop',
    platform: 'macos',
    architecture: 'arm64',
    format: 'zip',
    capabilities: ['access', 'manage', 'publish'],
    file: 'Vela-Desktop-0.1.0-macos-arm64.zip',
    size: fs.statSync(path.join(macos.builder, 'Vela-Desktop-0.1.0-macos-arm64.zip')).size,
    sha256: macos.manifest.artifacts[0].sha256,
    minimumSystemVersion: '14.0',
    signing: 'adhoc',
    notarized: false,
  });
  assert.equal(linux.manifest.artifacts[0].component, 'node');
  assert.deepEqual(linux.manifest.artifacts[0].capabilities, ['manage-cli', 'manage-web', 'publish']);
  assert.equal(linux.manifest.artifacts[0].signing, 'none');
  assert.doesNotThrow(() => validateReleaseManifest(macos.manifest, { assetsDirectory: macos.builder }));
  assert.doesNotThrow(() => validateReleaseManifest(linux.manifest, { assetsDirectory: linux.builder }));
});

test('统一入口生成稳定排序的校验和、清单与中文发布说明', () => {
  const macos = prepareBuilder('macos');
  const linux = prepareBuilder('linux-node');
  const firstOutput = path.join(temporaryDirectory('assemble-first'), 'release');
  const secondOutput = path.join(temporaryDirectory('assemble-second'), 'release');

  const manifest = assembleRelease({
    builderDirectories: [linux.builder, macos.builder],
    outputDirectory: firstOutput,
  });
  assembleRelease({
    builderDirectories: [macos.builder, linux.builder],
    outputDirectory: secondOutput,
  });

  const runtimeFiles = manifest.artifacts.map(({ file }) => file).sort();
  const checksumLines = fs.readFileSync(path.join(firstOutput, 'SHA256SUMS'), 'utf8').trimEnd().split('\n');
  assert.deepEqual(
    checksumLines.map((line) => line.slice(66)),
    runtimeFiles,
    'SHA256SUMS 必须稳定排序并覆盖每个运行资产',
  );
  for (const line of checksumLines) assert.match(line, /^[a-f0-9]{64}  \S+$/u);
  for (const file of ['SHA256SUMS', 'release.json', 'release-notes.md', ...runtimeFiles]) {
    assert.ok(fs.statSync(path.join(firstOutput, file)).isFile(), `缺少标准资产 ${file}`);
  }
  for (const file of ['SHA256SUMS', 'release.json', 'release-notes.md']) {
    assert.equal(
      fs.readFileSync(path.join(firstOutput, file), 'utf8'),
      fs.readFileSync(path.join(secondOutput, file), 'utf8'),
      `${file} 不应受 builder 输入顺序影响`,
    );
  }

  const notes = fs.readFileSync(path.join(firstOutput, 'release-notes.md'), 'utf8');
  assert.match(notes, /系统设置 → 隐私与安全/u);
  assert.match(notes, /仍要打开/u);
  assert.match(notes, /shasum -a 256 -c SHA256SUMS/u);
  for (const file of runtimeFiles) {
    assert.match(notes, new RegExp(`gh attestation verify ${file.replaceAll('.', '\\.')}`));
  }
  assert.match(notes, /https:\/\/github\.com\/thonatos\/project-v\/tree\/0123456789abcdef/u);
  assert.match(notes, /未使用 Apple Developer ID 签名/u);
  assert.match(notes, /未经 Apple 公证/u);
  assert.doesNotMatch(notes, /已使用 Apple Developer ID|已经?公证/u);
  assert.match(notes, /Vela 的首个公开版本/u);
  assert.match(notes, /## 主要功能/u);
  assert.match(notes, /HTTP 与 TCP loopback 服务/u);
  assert.doesNotMatch(notes, /草稿预发布|人工确认/u);
});

test('统一入口拒绝重复文件名', () => {
  const macos = prepareBuilder('macos');
  const output = path.join(temporaryDirectory('duplicate-output'), 'release');
  assert.throws(
    () => assembleRelease({ builderDirectories: [macos.builder, macos.builder], outputDirectory: output }),
    /重复文件名/u,
  );
  assert.equal(fs.existsSync(output), false, '预检失败不得创建发布目录');
});

test('统一入口拒绝未知 schema', () => {
  const fixture = prepareBuilder('macos');
  const document = JSON.parse(fs.readFileSync(path.join(fixture.builder, 'release.json'), 'utf8'));
  document.schemaVersion = 2;
  fs.writeFileSync(path.join(fixture.builder, 'release.json'), JSON.stringify(document));
  const output = path.join(temporaryDirectory('schema-output'), 'release');
  assert.throws(
    () => assembleRelease({ builderDirectories: [fixture.builder], outputDirectory: output }),
    /未知 release\.json schema/u,
  );
  assert.equal(fs.existsSync(output), false);
});

test('统一入口拒绝摘要不一致', () => {
  const fixture = prepareBuilder('macos');
  const asset = path.join(fixture.builder, fixture.manifest.artifacts[0].file);
  const contents = fs.readFileSync(asset);
  contents[0] ^= 0xff;
  fs.writeFileSync(asset, contents);
  const output = path.join(temporaryDirectory('digest-output'), 'release');
  assert.throws(
    () => assembleRelease({ builderDirectories: [fixture.builder], outputDirectory: output }),
    /资产摘要不一致/u,
  );
  assert.equal(fs.existsSync(output), false);
});

test('统一入口拒绝缺失的标准运行资产', () => {
  const fixture = prepareBuilder('macos');
  fs.rmSync(path.join(fixture.builder, fixture.manifest.artifacts[0].file));
  const output = path.join(temporaryDirectory('missing-output'), 'release');
  assert.throws(
    () => assembleRelease({ builderDirectories: [fixture.builder], outputDirectory: output }),
    /缺失标准运行资产/u,
  );
  assert.equal(fs.existsSync(output), false);
});

test('统一入口拒绝缺失的平台 release.json', () => {
  const builder = temporaryDirectory('missing-manifest-builder');
  const output = path.join(temporaryDirectory('missing-manifest-output'), 'release');
  assert.throws(
    () => assembleRelease({ builderDirectories: [builder], outputDirectory: output }),
    /缺失标准资产 release\.json/u,
  );
  assert.equal(fs.existsSync(output), false);
});
