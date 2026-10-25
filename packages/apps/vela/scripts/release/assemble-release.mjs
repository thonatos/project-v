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
    'Vela 的首个公开版本。它让同一 Tailnet 中的设备安全访问 Mac 上运行的本地开发服务：Mac 负责服务共享与转发，其他 Mac 和 iPhone 可以发现设备并打开已授权的服务。',
    '',
    '## 主要功能',
    '',
    '- 共享 Mac 上的 HTTP 与 TCP loopback 服务，包括 OpenCode、DSH、SSH、Redis、MySQL、PostgreSQL 和自定义服务。',
    '- 通过内嵌 tsnet 加入用户自己的 Tailnet，不安装系统 VPN 或 Network Extension，也不修改系统代理、DNS 和路由。',
    '- 发现并管理其他 Vela 设备，为远端服务建立稳定的本地转发地址。',
    '- 使用独立的 `.localhost` 主机名隔离不同设备和服务的 Cookie 与 localStorage。',
    '- 提供连接状态、运行日志和脱敏诊断；认证 URL、密钥、Cookie 和页面内容不会写入诊断。',
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
