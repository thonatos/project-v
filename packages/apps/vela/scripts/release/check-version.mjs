#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT), '../..');

function plistVersion(text, source) {
  const match = text.match(/<key>\s*CFBundleShortVersionString\s*<\/key>\s*<string>\s*([^<\s]+)\s*<\/string>/);
  if (!match) throw new Error(`${source}: 缺少 CFBundleShortVersionString`);
  return match[1];
}

function readVersionSources(root) {
  const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
  const jsonVersion = (relative) => JSON.parse(read(relative)).version;
  const sharedSource = 'shared/ui/version.ts';
  const sharedMatch = read(sharedSource).match(/\bAPP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!sharedMatch) throw new Error(`${sharedSource}: 缺少 APP_VERSION`);

  const projectSource = 'ios/app/Vela.xcodeproj/project.pbxproj';
  const projectVersions = [...read(projectSource).matchAll(/\bMARKETING_VERSION\s*=\s*([^;\s]+)\s*;/g)].map(
    (match) => match[1],
  );
  if (projectVersions.length === 0) throw new Error(`${projectSource}: 缺少 MARKETING_VERSION`);

  return {
    'package.json': jsonVersion('package.json'),
    [sharedSource]: sharedMatch[1],
    'macos/ui/nsh.json': jsonVersion('macos/ui/nsh.json'),
    'ios/ui/nsh.json': jsonVersion('ios/ui/nsh.json'),
    'macos/app/Info.plist': plistVersion(read('macos/app/Info.plist'), 'macos/app/Info.plist'),
    'ios/app/Vela/Info.plist': plistVersion(read('ios/app/Vela/Info.plist'), 'ios/app/Vela/Info.plist'),
    ...Object.fromEntries(
      projectVersions.map((version, index) => [`${projectSource} MARKETING_VERSION[${index + 1}]`, version]),
    ),
  };
}

export function validateVersions(tag, sources) {
  const tagMatch = /^vela-v(\d+\.\d+\.\d+)$/.exec(tag ?? '');
  if (!tagMatch) {
    throw new Error(`Vela 版本校验失败:\n- tag: ${tag || '<missing>'}（必须匹配 vela-vX.Y.Z）`);
  }
  const expected = tagMatch[1];
  const mismatches = Object.entries(sources).filter(([, version]) => version !== expected);
  if (mismatches.length > 0) {
    throw new Error(
      `Vela 版本校验失败（tag ${tag} 要求 ${expected}）:\n${mismatches
        .map(([source, version]) => `- ${source}: ${version ?? '<missing>'}（期望 ${expected}）`)
        .join('\n')}`,
    );
  }
  return expected;
}

function options(argv) {
  const result = { root: DEFAULT_ROOT, tag: process.env.GITHUB_REF_NAME, fixture: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const value = argv[index + 1];
    if (option === '--root' && value) result.root = path.resolve(value);
    else if (option === '--tag' && value) result.tag = value;
    else if (option === '--fixture' && value) result.fixture = path.resolve(value);
    else throw new Error(`未知或缺少参数: ${option}`);
    index += 1;
  }
  return result;
}

export function main(argv = process.argv.slice(2)) {
  const selected = options(argv);
  const fixture = selected.fixture ? JSON.parse(fs.readFileSync(selected.fixture, 'utf8')) : undefined;
  const tag = fixture?.tag ?? selected.tag;
  const sources = fixture?.sources ?? readVersionSources(selected.root);
  const version = validateVersions(tag, sources);
  console.log(`Vela 版本校验通过: ${version}（${Object.keys(sources).length} 个来源）`);
}

if (path.resolve(process.argv[1] ?? '') === SCRIPT) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
