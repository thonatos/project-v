#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  RELEASE_SCHEMA_VERSION,
  createReleaseManifest,
  serializeReleaseManifest,
  validateReleaseManifest,
} from './release-manifest.mjs';

const REPOSITORY_URL = 'https://github.com/thonatos/project-v';

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

export function createReleaseNotes(manifest) {
  const lines = [
    `# Vela ${manifest.version}`,
    '',
    '此版本由项目的 GitHub Actions 从对应标签构建。自动化只创建草稿预发布，公开前仍需维护者人工确认。',
    '',
    '## 运行资产',
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
      '## macOS 安装与信任状态',
      '',
      `- 系统要求：macOS ${minimumVersions.join(' 或 ')} 或更高版本；请按资产架构选择兼容的 Mac。`,
      '- macOS 资产仅使用 ad-hoc 签名，未使用 Apple Developer ID 签名，未经 Apple 公证。',
      '- 将应用拖入“应用程序”目录并首次尝试打开。若 Gatekeeper 阻止启动，请打开“系统设置 → 隐私与安全”，找到该应用的提示并点击“仍要打开”，然后确认。',
      '- SHA-256 与 GitHub Artifact Attestation 只验证文件内容和 GitHub Actions 构建来源，不代表 Apple 信任该应用。',
      '',
    );
  }

  lines.push(
    '## 验证下载',
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

export function assembleRelease({ builderDirectories, outputDirectory }) {
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
  fs.writeFileSync(path.join(resolvedOutput, 'release-notes.md'), createReleaseNotes(manifest));

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
