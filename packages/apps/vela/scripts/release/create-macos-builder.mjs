#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createReleaseManifest, serializeReleaseManifest } from './release-manifest.mjs';

function parse(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`参数缺少值：${name ?? ''}`);
    if (name === '--version') result.version = value;
    else if (name === '--tag') result.tag = value;
    else if (name === '--commit') result.commit = value;
    else if (name === '--asset') result.asset = path.resolve(value);
    else if (name === '--output') result.output = path.resolve(value);
    else throw new Error(`未知参数：${name}`);
  }
  for (const key of ['version', 'tag', 'commit', 'asset', 'output']) {
    if (!result[key]) throw new Error(`缺少参数：--${key}`);
  }
  return result;
}

export function createMacosBuilder(argv) {
  const options = parse(argv);
  const name = `Vela-Desktop-${options.version}-macos-arm64.zip`;
  if (path.basename(options.asset) !== name) throw new Error(`macOS 资产名必须是 ${name}`);
  fs.mkdirSync(options.output, { recursive: true });
  fs.copyFileSync(options.asset, path.join(options.output, name));
  const descriptor = {
    schemaVersion: 1,
    product: 'vela',
    version: options.version,
    tag: options.tag,
    commit: options.commit,
    protocolVersion: 1,
    artifacts: [
      {
        component: 'desktop',
        platform: 'macos',
        architecture: 'arm64',
        format: 'zip',
        capabilities: ['publish', 'access', 'manage'],
        file: name,
        size: 0,
        sha256: '0'.repeat(64),
        minimumSystemVersion: '14.0',
        signing: 'adhoc',
        notarized: false,
      },
    ],
  };
  const manifest = createReleaseManifest(descriptor, options.output);
  fs.writeFileSync(path.join(options.output, 'release.json'), serializeReleaseManifest(manifest));
  return manifest;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    createMacosBuilder(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
