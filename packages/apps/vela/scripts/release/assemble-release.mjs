#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  RELEASE_SCHEMA_VERSION,
  createReleaseManifest,
  serializeReleaseManifest,
  validateReleaseManifest,
} from './release-manifest.mjs';

const REPOSITORY_URL = 'https://github.com/thonatos/project-v';
const DEFAULT_RELEASES_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../releases');
const RESERVED_RELEASE_HEADINGS = new Set(['下载', 'macOS 安装', '验证下载']);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(message) {
  throw new Error(message);
}

export function createSha256Sums(artifacts) {
  return (
    [...artifacts]
      .sort((left, right) => compareText(left.file, right.file))
      .map((artifact) => `${artifact.sha256}  ${artifact.file}`)
      .join('\n') + '\n'
  );
}

function artifactLabel(artifact) {
  return `${artifact.component} / ${artifact.platform} / ${artifact.architecture}`;
}

export function readVersionNotes(version, releasesDirectory = DEFAULT_RELEASES_DIRECTORY) {
  const file = path.join(releasesDirectory, `${version}.md`);
  let contents;
  try {
    contents = fs.readFileSync(file, 'utf8').trim();
  } catch (error) {
    if (error.code === 'ENOENT') fail(`缺少版本说明：${file}`);
    throw error;
  }
  if (contents === '') fail(`版本说明不能为空：${file}`);
  if (/^# /mu.test(contents)) fail(`版本说明不得包含一级标题，标题由发布模板生成：${file}`);
  for (const match of contents.matchAll(/^##\s+(.+)$/gmu)) {
    if (RESERVED_RELEASE_HEADINGS.has(match[1].trim())) {
      fail(`版本说明不得覆盖保留区块“${match[1].trim()}”：${file}`);
    }
  }
  if (/\b(?:TODO|TBD|FIXME)\b|<!--|-->/iu.test(contents)) {
    fail(`版本说明包含占位内容：${file}`);
  }
  if (!/[\p{L}\p{N}]/u.test(contents)) fail(`版本说明缺少有效内容：${file}`);
  return contents;
}

export function createReleaseNotes(manifest, versionNotes) {
  const lines = [
    `# Vela ${manifest.version}`,
    '',
    versionNotes,
    '',
    '## 下载',
    '',
    '| 资产 | 组件 / 平台 / 架构 | 能力 |',
    '| --- | --- | --- |',
    ...manifest.artifacts.map(
      (artifact) => `| \`${artifact.file}\` | ${artifactLabel(artifact)} | ${artifact.capabilities.join('、')} |`,
    ),
    '',
  ];

  const macosArtifacts = manifest.artifacts.filter((artifact) => artifact.platform === 'macos');
  if (macosArtifacts.length > 0) {
    const minimumVersions = [...new Set(macosArtifacts.map((artifact) => artifact.minimumSystemVersion))].sort(
      compareText,
    );
    lines.push(
      '## macOS 安装',
      '',
      `1. 下载并解压适用于 macOS ${minimumVersions.join(' 或 ')} 或更高版本、Apple Silicon 的 ZIP。`,
      '2. 将 `Vela.app` 拖入“应用程序”。',
      '3. 首次打开若被 Gatekeeper 阻止，请前往“系统设置 → 隐私与安全”，在 Vela 的提示旁点击“仍要打开”，然后确认。',
      '',
      '> 当前 macOS 资产采用 ad-hoc 签名，未使用 Apple Developer ID 签名，未经 Apple 公证。因此首次运行需要手动确认。',
      '',
    );
  }

  lines.push(
    '## 验证下载',
    '',
    '本版本由 GitHub Actions 从对应 tag 构建。SHA-256 用于检查下载完整性，GitHub Artifact Attestation 用于验证构建来源。',
    '',
    '将运行资产与 `SHA256SUMS` 放在同一目录，然后执行：',
    '',
    '```sh',
    'shasum -a 256 -c SHA256SUMS',
    '```',
    '',
    '逐个验证运行资产的 GitHub 构建来源：',
    '',
    '```sh',
    ...manifest.artifacts.map((artifact) => `gh attestation verify ${artifact.file} --repo thonatos/project-v`),
    '```',
    '',
    `源代码：[${manifest.tag}](${REPOSITORY_URL}/tree/${manifest.commit})`,
    '',
  );
  return lines.join('\n');
}

function readBuilder(builderDirectory) {
  const manifestFile = path.join(builderDirectory, 'release.json');
  let document;
  try {
    document = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') fail(`平台 builder 缺失标准资产 release.json：${builderDirectory}`);
    fail(`无法读取平台 builder 清单 ${manifestFile}：${error.message}`);
  }
  if (document.schemaVersion !== RELEASE_SCHEMA_VERSION) {
    fail(`未知 release.json schema：${String(document.schemaVersion)}（${manifestFile}）`);
  }
  return validateReleaseManifest(document, { assetsDirectory: builderDirectory });
}

function assertSameRelease(expected, actual, builderDirectory) {
  for (const key of ['schemaVersion', 'product', 'version', 'tag', 'commit', 'protocolVersion']) {
    if (actual[key] !== expected[key]) {
      fail(`平台 builder 发布身份不一致：${builderDirectory} 的 ${key} 为 ${actual[key]}，预期 ${expected[key]}`);
    }
  }
}

function assertOutputAvailable(outputDirectory) {
  if (!fs.existsSync(outputDirectory)) return;
  if (!fs.statSync(outputDirectory).isDirectory()) fail(`输出路径不是目录：${outputDirectory}`);
  if (fs.readdirSync(outputDirectory).length !== 0) fail(`输出目录必须不存在或为空：${outputDirectory}`);
}

export function assembleRelease({
  builderDirectories,
  outputDirectory,
  releasesDirectory = DEFAULT_RELEASES_DIRECTORY,
}) {
  if (!Array.isArray(builderDirectories) || builderDirectories.length === 0) {
    fail('至少需要一个平台 builder 输出目录');
  }
  const builders = builderDirectories.map((directory) => ({
    directory: path.resolve(directory),
    manifest: readBuilder(path.resolve(directory)),
  }));
  const identity = builders[0].manifest;
  for (const builder of builders.slice(1)) assertSameRelease(identity, builder.manifest, builder.directory);

  const seenFiles = new Map();
  const artifacts = [];
  for (const builder of builders) {
    for (const artifact of builder.manifest.artifacts) {
      const previous = seenFiles.get(artifact.file);
      if (previous !== undefined) {
        fail(`平台 builder 包含重复文件名：${artifact.file}（${previous} 与 ${builder.directory}）`);
      }
      seenFiles.set(artifact.file, builder.directory);
      artifacts.push(artifact);
    }
  }
  const versionNotes = readVersionNotes(identity.version, releasesDirectory);

  const resolvedOutput = path.resolve(outputDirectory);
  assertOutputAvailable(resolvedOutput);
  fs.mkdirSync(resolvedOutput, { recursive: true });
  for (const artifact of artifacts) {
    fs.copyFileSync(path.join(seenFiles.get(artifact.file), artifact.file), path.join(resolvedOutput, artifact.file));
  }

  const descriptor = {
    schemaVersion: RELEASE_SCHEMA_VERSION,
    product: identity.product,
    version: identity.version,
    tag: identity.tag,
    commit: identity.commit,
    protocolVersion: identity.protocolVersion,
    artifacts,
  };
  // 复制后再次对照 builder 声明校验，避免输入在预检与复制之间发生变化。
  validateReleaseManifest(descriptor, { assetsDirectory: resolvedOutput });
  const manifest = createReleaseManifest(descriptor, resolvedOutput);
  fs.writeFileSync(path.join(resolvedOutput, 'SHA256SUMS'), createSha256Sums(manifest.artifacts));
  fs.writeFileSync(path.join(resolvedOutput, 'release.json'), serializeReleaseManifest(manifest));
  fs.writeFileSync(path.join(resolvedOutput, 'release-notes.md'), createReleaseNotes(manifest, versionNotes));

  const requiredFiles = [
    'SHA256SUMS',
    'release.json',
    'release-notes.md',
    ...manifest.artifacts.map(({ file }) => file),
  ];
  for (const file of requiredFiles) {
    if (!fs.statSync(path.join(resolvedOutput, file)).isFile()) fail(`组装结果缺失标准资产：${file}`);
  }
  return manifest;
}

function parseArguments(argumentsList) {
  const builderDirectories = [];
  let outputDirectory;
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (value === undefined) fail(`参数缺少值：${name ?? ''}`);
    if (name === '--builder') builderDirectories.push(value);
    else if (name === '--output' && outputDirectory === undefined) outputDirectory = value;
    else fail(`无法识别或重复的参数：${name}`);
  }
  if (outputDirectory === undefined) fail('缺少参数：--output');
  return { builderDirectories, outputDirectory };
}

export function runAssembleReleaseCli(argumentsList) {
  const options = parseArguments(argumentsList);
  const manifest = assembleRelease(options);
  console.log(`已组装 ${manifest.artifacts.length} 个运行资产：${path.resolve(options.outputDirectory)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runAssembleReleaseCli(process.argv.slice(2));
  } catch (error) {
    console.error(`发布组装失败：${error.message}`);
    process.exitCode = 1;
  }
}
