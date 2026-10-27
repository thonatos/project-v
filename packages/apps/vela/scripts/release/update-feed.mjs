#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateReleaseManifest } from './release-manifest.mjs';

export const FEED_PATH = 'vela/macos/appcast.xml';
const BUNDLE_ID = 'io.implements.vela.macos';

const escapeXml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function fail(message) {
  throw new Error(message);
}

function plistValue(plist, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = plist.match(new RegExp(`<key>\\s*${escaped}\\s*</key>\\s*<string>\\s*([^<]+)\\s*</string>`));
  if (!match) fail(`Info.plist 缺少 ${key}`);
  return match[1].trim();
}

export function compareBuild(left, right) {
  const a = Number.parseInt(String(left), 10);
  const b = Number.parseInt(String(right), 10);
  if (!Number.isSafeInteger(a) || a < 1 || !Number.isSafeInteger(b) || b < 1) fail('Apple build 必须是正整数');
  return a - b;
}

export function inspectRelease({ releaseDirectory, expectedTag, previousBuild = 0 }) {
  const document = JSON.parse(fs.readFileSync(path.join(releaseDirectory, 'release.json'), 'utf8'));
  const manifest = validateReleaseManifest(document, { assetsDirectory: releaseDirectory });
  if (manifest.tag !== expectedTag) fail(`Release tag ${expectedTag} 与清单 ${manifest.tag} 不一致`);
  const artifact = manifest.artifacts.find(
    (entry) =>
      entry.component === 'desktop' &&
      entry.platform === 'macos' &&
      entry.architecture === 'arm64' &&
      entry.format === 'zip',
  );
  if (!artifact) fail('Release 缺少 macOS arm64 desktop ZIP');
  const archive = path.join(releaseDirectory, artifact.file);
  const plist = execFileSync('unzip', ['-p', archive, 'Vela.app/Contents/Info.plist'], { encoding: 'utf8' });
  const id = plistValue(plist, 'CFBundleIdentifier');
  const version = plistValue(plist, 'CFBundleShortVersionString');
  const build = plistValue(plist, 'CFBundleVersion');
  const minimumSystemVersion = plistValue(plist, 'LSMinimumSystemVersion');
  if (id !== BUNDLE_ID) fail(`bundle id 为 ${id}，期望 ${BUNDLE_ID}`);
  if (version !== manifest.version) fail(`bundle 版本 ${version} 与清单 ${manifest.version} 不一致`);
  if (minimumSystemVersion !== artifact.minimumSystemVersion) fail('bundle 最低系统版本与清单不一致');
  if (Number(previousBuild) > 0 && compareBuild(build, previousBuild) <= 0)
    fail(`build ${build} 不高于当前 feed build ${previousBuild}`);
  return { manifest, artifact, archive, version, build, minimumSystemVersion, sha256: sha256(archive) };
}

export function signArchive({ signTool, archive, privateKey }) {
  if (!privateKey?.trim()) fail('缺少 Vela 更新私钥');
  const output = execFileSync(signTool, ['--ed-key-file', '-', archive], {
    input: `${privateKey.trim()}\n`,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
  const signature = /sparkle:edSignature="([^"]+)"/.exec(output)?.[1];
  const length = /length="([0-9]+)"/.exec(output)?.[1];
  if (!signature || !length) fail('Sparkle sign_update 未返回签名和长度');
  if (Number(length) !== fs.statSync(archive).size) fail('Sparkle 签名长度与 ZIP 不一致');
  execFileSync(signTool, ['--verify', '--ed-key-file', '-', archive, signature], {
    input: `${privateKey.trim()}\n`,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return { signature, length: Number(length) };
}

export function createAppcast({ release, signature, downloadUrl, notesUrl, publishedAt }) {
  const safeUrl = (value) => {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname))
    );
  };
  if (!safeUrl(downloadUrl) || !safeUrl(notesUrl)) fail('feed URL 必须使用 HTTPS（仅 loopback 验收允许 HTTP）');
  if (!signature?.signature || signature.length !== release.artifact.size) fail('feed 签名或长度与资产不一致');
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Vela macOS 稳定更新</title>
    <item>
      <title>Vela ${escapeXml(release.version)}</title>
      <pubDate>${escapeXml(new Date(publishedAt).toUTCString())}</pubDate>
      <sparkle:version>${escapeXml(release.build)}</sparkle:version>
      <sparkle:shortVersionString>${escapeXml(release.version)}</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>${escapeXml(release.minimumSystemVersion)}</sparkle:minimumSystemVersion>
      <sparkle:releaseNotesLink>${escapeXml(notesUrl)}</sparkle:releaseNotesLink>
      <enclosure url="${escapeXml(downloadUrl)}" length="${signature.length}" type="application/octet-stream" sparkle:edSignature="${escapeXml(signature.signature)}" />
    </item>
  </channel>
</rss>
`;
}

export function feedBuild(xml) {
  const match = xml.match(/<sparkle:version>([0-9]+)<\/sparkle:version>/);
  return match ? Number(match[1]) : 0;
}

export function main(argv = process.argv.slice(2)) {
  const options = new Map();
  for (let index = 0; index < argv.length; index += 2) options.set(argv[index], argv[index + 1]);
  const releaseDirectory = path.resolve(options.get('--release-dir') ?? '');
  const output = path.resolve(options.get('--output') ?? '');
  const tag = options.get('--tag');
  const baseUrl = options.get('--release-url');
  const publishedAt = options.get('--published-at');
  const signTool = path.resolve(options.get('--sign-tool') ?? '');
  if (!tag || !baseUrl || !publishedAt || !releaseDirectory || !output || !signTool) fail('缺少 feed 生成参数');
  const previous = fs.existsSync(output) ? feedBuild(fs.readFileSync(output, 'utf8')) : 0;
  const release = inspectRelease({ releaseDirectory, expectedTag: tag, previousBuild: previous });
  const privateKey = process.env.VELA_UPDATE_PRIVATE_KEY;
  const signature = signArchive({ signTool, archive: release.archive, privateKey });
  const downloadUrl = `${baseUrl}/${encodeURIComponent(release.artifact.file)}`;
  const notesUrl = `${baseUrl}/release-notes.md`;
  const xml = createAppcast({ release, signature, downloadUrl, notesUrl, publishedAt });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, xml);
  console.log(`已生成 Vela stable appcast build ${release.build}: ${output}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
