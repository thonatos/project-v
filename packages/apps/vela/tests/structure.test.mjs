/**
 * Vela's platform/shared dependency contract.
 *
 * A platform tree may depend on shared code; shared code may not depend on a
 * platform; the two platforms may not depend on each other. This file is the
 * only place that knows the current directory names, so moving directories
 * means editing LAYOUT below and nothing else.
 *
 * Go and Rust boundaries are checked by `verify-ios-deps.sh`; this test covers
 * the TypeScript graph, which is where the two clients share the most code.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Platform-first layout: each platform owns its UI, native host and packaging
// inputs; shared/ and core/ are consumed by both and never reach back.
const LAYOUT = {
  platforms: {
    macos: ['macos'],
    ios: ['ios'],
  },
  shared: ['shared', 'core'],
};

const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.mts', '.js', '.jsx'];
const SKIP = new Set(['node_modules', '.nsh', 'build', 'target', '.tmp', 'dist', '.git']);
// `from "./x"`, `import("./x")`, `require("./x")` and side-effect `import "./x"`.
const SPECIFIER = /(?:\bfrom\b|\bimport\s*\(|\brequire\s*\(|\bimport)\s*["'](\.[^"']+)["']/g;

function walk(directory, out = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, out);
    else if (EXTENSIONS.includes(path.extname(entry.name))) out.push(absolute);
  }
  return out;
}

function ownerOf(absolute) {
  const relative = path.relative(ROOT, absolute);
  if (relative.startsWith('..')) return null;
  const top = relative.split(path.sep)[0];
  for (const [platform, roots] of Object.entries(LAYOUT.platforms)) {
    if (roots.includes(top)) return platform;
  }
  return LAYOUT.shared.includes(top) ? 'shared' : null;
}

function resolveImport(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    ...EXTENSIONS.map((extension) => base + extension),
    ...EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

const sources = [...LAYOUT.platforms.macos, ...LAYOUT.platforms.ios, ...LAYOUT.shared]
  .flatMap((top) => {
    const directory = path.join(ROOT, top);
    return fs.existsSync(directory) ? walk(directory) : [];
  })
  .sort();

assert.ok(sources.length > 20, `structure check found only ${sources.length} sources; the layout map is stale`);

const violations = [];
const unclassified = [];

for (const file of sources) {
  const source = ownerOf(file);
  if (source === null) {
    unclassified.push(path.relative(ROOT, file));
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  for (const [, specifier] of text.matchAll(SPECIFIER)) {
    const target = resolveImport(file, specifier);
    if (target === undefined) continue;
    const targetOwner = ownerOf(target);
    if (targetOwner === null) {
      unclassified.push(`${path.relative(ROOT, file)} -> ${path.relative(ROOT, target)}`);
      continue;
    }
    if (source === 'shared' && targetOwner !== 'shared') {
      violations.push(
        `${path.relative(ROOT, file)} -> ${path.relative(ROOT, target)} (shared code imported a platform)`,
      );
    }
    if (source !== 'shared' && targetOwner !== 'shared' && source !== targetOwner) {
      violations.push(
        `${path.relative(ROOT, file)} -> ${path.relative(ROOT, target)} (${source} imported ${targetOwner})`,
      );
    }
  }
}

assert.deepEqual(
  unclassified,
  [],
  `every scanned file must belong to a platform or to shared code; add it to LAYOUT or move it:\n  ${unclassified.join('\n  ')}`,
);
assert.deepEqual(violations, [], `platform and shared boundaries must hold:\n  ${violations.join('\n  ')}`);

// Platform stores compose the shared flows. A protocol call that belongs to a
// flow must not reappear beside its state machine.
const FLOW_OWNED = /core\.(startAuth|addRemote|removeRemote|renameDevice|updatePreferences)\s*\(/;
for (const store of ['macos/ui/core/store.ts', 'ios/ui/core/store.ts']) {
  assert.doesNotMatch(
    fs.readFileSync(path.join(ROOT, store), 'utf8'),
    FLOW_OWNED,
    `${store}: identity, saved-device, rename and preference calls belong in shared/ui/flows`,
  );
}

// Each app has exactly one place that sends Core requests: its client wrapper.
for (const [platform, roots] of Object.entries(LAYOUT.platforms)) {
  const senders = sources.filter(
    (file) =>
      roots.includes(path.relative(ROOT, file).split(path.sep)[0]) &&
      /CoreBridge\.request/.test(fs.readFileSync(file, 'utf8')),
  );
  assert.equal(
    senders.length,
    1,
    `${platform} must send Core requests from exactly one module, found: ${senders.map((file) => path.relative(ROOT, file)).join(', ') || 'none'}`,
  );
}

console.log(`Vela structure passed: ${sources.length} TypeScript sources respect the platform/shared boundary`);
