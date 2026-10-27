#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const DEFAULT_VELA_ROOT = path.resolve(path.dirname(SCRIPT), '../..');
const REQUIRED = {
  schemaVersion: 1,
  node: '24',
  pnpm: '12.14.0',
  rust: '1.98.1',
  go: '1.27.2',
  'nsh.version': '0.2.0',
  'nsh.archive.platform': 'macos',
  'nsh.archive.architecture': 'arm64',
  'nsh.archive.format': 'tar.gz',
  'nsh.archive.file': 'nsh-macos-arm64.tar.gz',
  'nsh.archive.url': 'https://github.com/longbridge/nsh/releases/download/v0.2.0/nsh-macos-arm64.tar.gz',
  'nsh.archive.sha256': 'a189be8537422a147131c88d7fd39d73265a6aebfbb530287c36a393ff3953fc',
  'nsh.source.repository': 'https://github.com/longbridge/nsh.git',
  'nsh.source.peeledCommit': '669b62b11449b2ab787b7c82649a392cbff25b8f',
  'sparkle.version': '2.10.1',
  'sparkle.archive.format': 'tar.xz',
  'sparkle.archive.file': 'Sparkle-2.10.1.tar.xz',
  'sparkle.archive.url': 'https://github.com/sparkle-project/Sparkle/releases/download/2.10.1/Sparkle-2.10.1.tar.xz',
  'sparkle.archive.sha256': '1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27',
  xcode: '27',
  macos: '14.0',
  architecture: 'arm64',
};

const REQUIRED_SPARKLE_PATHS = [
  'Sparkle.framework/Versions/B/Sparkle',
  'Sparkle.framework/Versions/B/Autoupdate',
  'Sparkle.framework/Versions/B/Updater.app/Contents/MacOS/Updater',
  'Sparkle.framework/Versions/B/XPCServices/Downloader.xpc/Contents/MacOS/Downloader',
  'Sparkle.framework/Versions/B/XPCServices/Installer.xpc/Contents/MacOS/Installer',
  'bin/sign_update',
];

function nested(value, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => current?.[key], value);
}

function capture(text, expression, source) {
  const match = text.match(expression);
  if (!match) throw new Error(`${source}: 找不到工具链版本声明`);
  return match[1];
}

function collectProjectConfiguration(velaRoot, repoRoot) {
  const readVela = (relative) => fs.readFileSync(path.join(velaRoot, relative), 'utf8');
  const readRepo = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
  const rootPackage = JSON.parse(readRepo('package.json'));
  const cargo = readVela('Cargo.toml');
  const iosPlist = readVela('ios/app/Vela/Info.plist');
  const nshDependencies = [...cargo.matchAll(/^nsh-[\w-]+\s*=\s*"=([^"]+)"/gm)].map((match) => match[1]);
  if (nshDependencies.length === 0) throw new Error('Cargo.toml: 找不到 NSH workspace 依赖');

  return {
    node: capture(
      readRepo('.github/workflows/nodejs-ci.yml'),
      /node-version:\s*['"]?([^'"\s]+)/,
      '.github/workflows/nodejs-ci.yml',
    ),
    pnpm: capture(rootPackage.packageManager ?? '', /^pnpm@(.+)$/, 'package.json#packageManager'),
    rust: capture(readVela('rust-toolchain.toml'), /^channel\s*=\s*"([^"]+)"/m, 'rust-toolchain.toml'),
    go: capture(readVela('core/go.mod'), /^go\s+([^\s]+)$/m, 'core/go.mod'),
    nshFile: readVela('.nsh-version').trim().replace(/^v/, ''),
    nshDependencies,
    xcode: capture(readVela('docs/ios.md'), /^\| Xcode\s+\|\s*([0-9]+)/m, 'docs/ios.md'),
    macos: capture(
      readVela('macos/app/Info.plist'),
      /<key>\s*LSMinimumSystemVersion\s*<\/key>\s*<string>\s*([^<\s]+)\s*<\/string>/,
      'macos/app/Info.plist',
    ),
    architecture: capture(
      iosPlist,
      /<key>\s*UIRequiredDeviceCapabilities\s*<\/key>\s*<array>\s*<string>\s*([^<\s]+)\s*<\/string>/,
      'ios/app/Vela/Info.plist',
    ),
    nshSourceCommit: capture(
      readVela('docs/development.md'),
      /NSH_SOURCE[^\n]*revision `([0-9a-f]{40})`/,
      'docs/development.md',
    ),
  };
}

export function validateToolchain(declaration, configuration) {
  const problems = [];
  for (const [field, expected] of Object.entries(REQUIRED)) {
    const actual = nested(declaration, field);
    if (actual !== expected)
      problems.push(`scripts/release/toolchain.json#${field}: ${actual ?? '<missing>'}（期望 ${expected}）`);
  }
  if (
    !Array.isArray(declaration.sparkle?.requiredPaths) ||
    declaration.sparkle.requiredPaths.length !== REQUIRED_SPARKLE_PATHS.length ||
    declaration.sparkle.requiredPaths.some((value, index) => value !== REQUIRED_SPARKLE_PATHS[index])
  ) {
    problems.push('scripts/release/toolchain.json#sparkle.requiredPaths: 缺少或包含非预期路径');
  }

  const comparisons = [
    ['.github/workflows/nodejs-ci.yml#node-version', configuration.node, declaration.node],
    ['package.json#packageManager', configuration.pnpm, declaration.pnpm],
    ['rust-toolchain.toml#channel', configuration.rust, declaration.rust],
    ['core/go.mod#go', configuration.go, declaration.go],
    ['.nsh-version', configuration.nshFile, declaration.nsh?.version],
    ['docs/ios.md#Xcode', configuration.xcode, declaration.xcode],
    ['macos/app/Info.plist#LSMinimumSystemVersion', configuration.macos, declaration.macos],
    ['ios/app/Vela/Info.plist#UIRequiredDeviceCapabilities', configuration.architecture, declaration.architecture],
    ['docs/development.md#NSH_SOURCE revision', configuration.nshSourceCommit, declaration.nsh?.source?.peeledCommit],
  ];
  for (const [source, actual, expected] of comparisons) {
    if (actual !== expected)
      problems.push(`${source}: ${actual ?? '<missing>'}（工具链声明为 ${expected ?? '<missing>'}）`);
  }
  configuration.nshDependencies.forEach((actual, index) => {
    if (actual !== declaration.nsh?.version) {
      problems.push(`Cargo.toml#nsh-dependency[${index + 1}]: ${actual}（工具链声明为 ${declaration.nsh?.version}）`);
    }
  });

  if (problems.length > 0) throw new Error(`Vela 发布工具链校验失败:\n- ${problems.join('\n- ')}`);
}

function options(argv) {
  const result = {
    velaRoot: DEFAULT_VELA_ROOT,
    repoRoot: path.resolve(DEFAULT_VELA_ROOT, '../../..'),
    declaration: path.join(path.dirname(SCRIPT), 'toolchain.json'),
  };
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`缺少参数值: ${option}`);
    if (option === '--vela-root') result.velaRoot = path.resolve(value);
    else if (option === '--repo-root') result.repoRoot = path.resolve(value);
    else if (option === '--declaration') result.declaration = path.resolve(value);
    else throw new Error(`未知参数: ${option}`);
  }
  return result;
}

export function main(argv = process.argv.slice(2)) {
  const selected = options(argv);
  const declaration = JSON.parse(fs.readFileSync(selected.declaration, 'utf8'));
  const configuration = collectProjectConfiguration(selected.velaRoot, selected.repoRoot);
  validateToolchain(declaration, configuration);
  console.log('Vela 发布工具链声明与项目配置一致');
}

if (path.resolve(process.argv[1] ?? '') === SCRIPT) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
