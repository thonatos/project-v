#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const RELEASE_SCHEMA_VERSION = 1;

const ALLOWED_MANIFEST_KEYS = new Set([
  'schemaVersion',
  'product',
  'version',
  'tag',
  'commit',
  'protocolVersion',
  'artifacts',
]);
const REQUIRED_ARTIFACT_KEYS = [
  'component',
  'platform',
  'architecture',
  'format',
  'capabilities',
  'file',
  'size',
  'sha256',
  'signing',
];
const OPTIONAL_ARTIFACT_KEYS = ['minimumSystemVersion', 'notarized'];
const ALLOWED_ARTIFACT_KEYS = new Set([...REQUIRED_ARTIFACT_KEYS, ...OPTIONAL_ARTIFACT_KEYS]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const RESERVED_ASSET_NAMES = new Set(['SHA256SUMS', 'release.json', 'release-notes.md']);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(message) {
  throw new Error(message);
}

function requireObject(value, location) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${location} 必须是对象`);
  }
}

function requireNonemptyString(value, location) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${location} 必须是非空字符串`);
  }
}

function assertSafeAssetName(file, location) {
  requireNonemptyString(file, location);
  if (file !== path.basename(file) || file === '.' || file === '..' || /[\r\n]/u.test(file)) {
    fail(`${location} 必须是没有目录或换行符的文件名`);
  }
  if (RESERVED_ASSET_NAMES.has(file)) fail(`${location} 不得占用标准元数据文件名：${file}`);
}

export function sha256File(file) {
  const hash = createHash('sha256');
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    let length;
    while ((length = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, length));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function normalizeArtifact(artifact, index, assetsDirectory, computeIntegrity) {
  const location = `artifacts[${index}]`;
  requireObject(artifact, location);
  for (const key of Object.keys(artifact)) {
    if (!ALLOWED_ARTIFACT_KEYS.has(key)) fail(`${location}.${key} 不是 schema version 1 字段`);
  }
  for (const key of ['component', 'platform', 'architecture', 'format', 'signing']) {
    requireNonemptyString(artifact[key], `${location}.${key}`);
  }
  assertSafeAssetName(artifact.file, `${location}.file`);
  if (!Array.isArray(artifact.capabilities) || artifact.capabilities.length === 0) {
    fail(`${location}.capabilities 必须是非空数组`);
  }
  const capabilities = artifact.capabilities.map((capability, capabilityIndex) => {
    requireNonemptyString(capability, `${location}.capabilities[${capabilityIndex}]`);
    return capability;
  });
  if (new Set(capabilities).size !== capabilities.length) {
    fail(`${location}.capabilities 不得包含重复值`);
  }

  let size = artifact.size;
  let sha256 = artifact.sha256;
  if (computeIntegrity) {
    const asset = path.join(assetsDirectory, artifact.file);
    let stat;
    try {
      stat = fs.lstatSync(asset);
    } catch (error) {
      if (error.code === 'ENOENT') fail(`缺失标准运行资产：${artifact.file}`);
      throw error;
    }
    if (!stat.isFile() || stat.isSymbolicLink()) fail(`标准运行资产必须是普通文件：${artifact.file}`);
    size = stat.size;
    sha256 = sha256File(asset);
  }
  if (!Number.isSafeInteger(size) || size < 0) fail(`${location}.size 必须是非负安全整数`);
  if (typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256)) {
    fail(`${location}.sha256 必须是小写 SHA-256 摘要`);
  }
  if (artifact.minimumSystemVersion !== undefined) {
    requireNonemptyString(artifact.minimumSystemVersion, `${location}.minimumSystemVersion`);
  }
  if (artifact.notarized !== undefined && typeof artifact.notarized !== 'boolean') {
    fail(`${location}.notarized 必须是布尔值`);
  }
  if (artifact.platform === 'macos') {
    requireNonemptyString(artifact.minimumSystemVersion, `${location}.minimumSystemVersion`);
    if (typeof artifact.notarized !== 'boolean') fail(`${location}.notarized 必须是布尔值`);
  }

  const normalized = {
    component: artifact.component,
    platform: artifact.platform,
    architecture: artifact.architecture,
    format: artifact.format,
    capabilities: [...capabilities].sort(compareText),
    file: artifact.file,
    size,
    sha256,
  };
  if (artifact.minimumSystemVersion !== undefined) {
    normalized.minimumSystemVersion = artifact.minimumSystemVersion;
  }
  normalized.signing = artifact.signing;
  if (artifact.notarized !== undefined) normalized.notarized = artifact.notarized;
  return normalized;
}

function normalizeManifest(document, { assetsDirectory, computeIntegrity = false } = {}) {
  requireObject(document, 'release.json');
  for (const key of Object.keys(document)) {
    if (!ALLOWED_MANIFEST_KEYS.has(key)) fail(`release.json.${key} 不是 schema version 1 字段`);
  }
  if (document.schemaVersion !== RELEASE_SCHEMA_VERSION) {
    fail(`未知 release.json schema：${String(document.schemaVersion)}`);
  }
  if (document.product !== 'vela') fail('release.json.product 必须是 vela');
  if (typeof document.version !== 'string' || !VERSION_PATTERN.test(document.version)) {
    fail('release.json.version 必须是语义版本');
  }
  if (document.tag !== `vela-v${document.version}`) {
    fail(`release.json.tag 必须是 vela-v${document.version}`);
  }
  if (typeof document.commit !== 'string' || !COMMIT_PATTERN.test(document.commit)) {
    fail('release.json.commit 必须是 40 位小写 Git 提交摘要');
  }
  if (!Number.isSafeInteger(document.protocolVersion) || document.protocolVersion < 1) {
    fail('release.json.protocolVersion 必须是正整数');
  }
  if (!Array.isArray(document.artifacts) || document.artifacts.length === 0) {
    fail('release.json.artifacts 必须是非空数组');
  }
  if (computeIntegrity && typeof assetsDirectory !== 'string') fail('校验资产时必须提供资产目录');

  const artifacts = document.artifacts
    .map((artifact, index) => normalizeArtifact(artifact, index, assetsDirectory, computeIntegrity))
    .sort((left, right) => compareText(left.file, right.file));
  const files = artifacts.map((artifact) => artifact.file);
  if (new Set(files).size !== files.length) fail('release.json 包含重复文件名');

  return {
    schemaVersion: RELEASE_SCHEMA_VERSION,
    product: 'vela',
    version: document.version,
    tag: document.tag,
    commit: document.commit,
    protocolVersion: document.protocolVersion,
    artifacts,
  };
}

export function createReleaseManifest(descriptor, assetsDirectory) {
  return normalizeManifest(descriptor, { assetsDirectory, computeIntegrity: true });
}

export function validateReleaseManifest(document, { assetsDirectory } = {}) {
  const normalized = normalizeManifest(document);
  if (assetsDirectory !== undefined) {
    for (const artifact of normalized.artifacts) {
      const asset = path.join(assetsDirectory, artifact.file);
      let stat;
      try {
        stat = fs.lstatSync(asset);
      } catch (error) {
        if (error.code === 'ENOENT') fail(`缺失标准运行资产：${artifact.file}`);
        throw error;
      }
      if (!stat.isFile() || stat.isSymbolicLink()) fail(`标准运行资产必须是普通文件：${artifact.file}`);
      if (stat.size !== artifact.size) {
        fail(`资产大小不一致：${artifact.file}，清单为 ${artifact.size}，实际为 ${stat.size}`);
      }
      const digest = sha256File(asset);
      if (digest !== artifact.sha256) {
        fail(`资产摘要不一致：${artifact.file}，清单为 ${artifact.sha256}，实际为 ${digest}`);
      }
    }
  }
  return normalized;
}

export function serializeReleaseManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function parseArguments(argumentsList) {
  const [command, ...rest] = argumentsList;
  const options = new Map();
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (!name?.startsWith('--') || value === undefined) fail(`无法识别参数：${name ?? ''}`);
    if (options.has(name)) fail(`参数重复：${name}`);
    options.set(name, value);
  }
  return { command, options };
}

function requiredOption(options, name) {
  const value = options.get(name);
  if (value === undefined) fail(`缺少参数：${name}`);
  return path.resolve(value);
}

export function runReleaseManifestCli(argumentsList) {
  const { command, options } = parseArguments(argumentsList);
  if (command === 'generate') {
    const descriptorFile = requiredOption(options, '--descriptor');
    const assetsDirectory = requiredOption(options, '--assets');
    const outputFile = requiredOption(options, '--output');
    const descriptor = JSON.parse(fs.readFileSync(descriptorFile, 'utf8'));
    const manifest = createReleaseManifest(descriptor, assetsDirectory);
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, serializeReleaseManifest(manifest));
    console.log(`已生成并校验 ${outputFile}`);
    return;
  }
  if (command === 'validate') {
    const manifestFile = requiredOption(options, '--manifest');
    const document = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const assets = options.has('--assets') ? requiredOption(options, '--assets') : undefined;
    validateReleaseManifest(document, { assetsDirectory: assets });
    console.log(`release.json schema version 1 校验通过：${manifestFile}`);
    return;
  }
  fail(
    '用法：release-manifest.mjs generate --descriptor <文件> --assets <目录> --output <文件>\n' +
      '   或 release-manifest.mjs validate --manifest <文件> [--assets <目录>]',
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runReleaseManifestCli(process.argv.slice(2));
  } catch (error) {
    console.error(`release manifest 失败：${error.message}`);
    process.exitCode = 1;
  }
}
