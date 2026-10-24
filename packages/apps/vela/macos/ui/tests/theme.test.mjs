import assert from 'node:assert/strict';
import fs from 'node:fs';

const nsh = JSON.parse(fs.readFileSync(new URL('../nsh.json', import.meta.url), 'utf8'));
const colors = nsh.tailwind.colors;
const base = JSON.parse(fs.readFileSync(new URL('../../../shared/tokens/base.json', import.meta.url), 'utf8'));

/** Reads a color, so a missing token fails with the key instead of `undefined`. */
function color(key) {
  const value = colors[key];
  assert.ok(value, `nsh.json must define ${key}`);
  return value.toUpperCase();
}

function luminance(value) {
  const channels = value
    .slice(1)
    .match(/../g)
    .map((part) => Number.parseInt(part, 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function ratio(a, b) {
  const [bright, dim] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (bright + 0.05) / (dim + 0.05);
}

// Brand colors both platforms share. Editing one value in base.json must move
// both apps; editing a single nsh.json must fail here.
for (const [scheme, prefix] of [
  ['light', ''],
  ['dark', 'dk-'],
]) {
  for (const [key, value] of Object.entries(base[scheme])) {
    assert.equal(color(`${prefix}${key}`), value.toUpperCase(), `${prefix}${key} must match shared/tokens/base.json`);
  }
}

// Every surface is paired with a foreground, so no view invents a readable color.
for (const surface of ['canvas', 'surface', 'sidebar', 'subtle', 'accent']) {
  for (const prefix of ['', 'dk-']) {
    assert.ok(colors[`${prefix}${surface}`], `nsh.json must define ${prefix}${surface}`);
    assert.ok(
      colors[`${prefix}${surface}-foreground`],
      `${prefix}${surface} must be paired with ${prefix}${surface}-foreground`,
    );
  }
}

// WCAG AA against the palette itself, so a future color change cannot silently
// drop below the threshold.
const foregrounds = ['text', 'muted', 'accent', 'success', 'warning', 'danger', 'offline'];
for (const prefix of ['', 'dk-']) {
  for (const key of foregrounds) {
    for (const background of ['surface', 'canvas']) {
      const measured = ratio(color(`${prefix}${key}`), color(`${prefix}${background}`));
      assert.ok(
        measured >= 4.5,
        `${prefix}${key} on ${prefix}${background} is ${measured.toFixed(2)}:1 and must meet WCAG AA`,
      );
    }
  }
  for (const key of ['sidebar-foreground', 'sidebar-subtle']) {
    const measured = ratio(color(`${prefix}${key}`), color(`${prefix}sidebar`));
    assert.ok(measured >= 4.5, `${prefix}${key} on the sidebar is ${measured.toFixed(2)}:1 and must meet WCAG AA`);
  }
  const onAccent = ratio(color(`${prefix}accent-foreground`), color(`${prefix}accent`));
  assert.ok(onAccent >= 4.5, `${prefix}accent-foreground on accent is ${onAccent.toFixed(2)}:1`);
  for (const [tone, text, surface] of [
    ['info', 'info-foreground', 'info-surface'],
    ['success', 'success-surface-foreground', 'success-surface'],
    ['warning', 'warning-surface-foreground', 'warning-surface'],
    ['danger', 'danger-surface-foreground', 'danger-surface'],
  ]) {
    const measured = ratio(color(`${prefix}${text}`), color(`${prefix}${surface}`));
    assert.ok(measured >= 4.5, `${prefix}${tone} alert text is ${measured.toFixed(2)}:1 and must meet WCAG AA`);
    assert.notEqual(
      color(`${prefix}${surface}`),
      color(`${prefix}canvas`),
      `${prefix}${tone} alert must stand out from the canvas`,
    );
  }
}

/**
 * Hex values live only in nsh.json and the shared token file, and `dark:`
 * variants only in the token module. Every other UI source composes tokens.
 */
const uiRoot = new URL('../', import.meta.url);
function sources(dir) {
  const out = [];
  for (const entry of fs.readdirSync(new URL(dir, uiRoot), { withFileTypes: true })) {
    const relative = `${dir}${entry.name}`;
    if (entry.isDirectory()) {
      if (!['tests', '.nsh', 'node_modules'].includes(entry.name)) out.push(...sources(`${relative}/`));
    } else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(relative);
    }
  }
  return out;
}
const files = sources('');
assert.ok(files.length > 10, 'the theme check must see the whole UI tree');
for (const file of files) {
  const content = fs.readFileSync(new URL(file, uiRoot), 'utf8');
  assert.doesNotMatch(content, /#[0-9A-Fa-f]{6}\b/, `${file} must use semantic tokens instead of hex colors`);
  assert.doesNotMatch(
    content,
    /bg-black\/|bg-white\//,
    `${file} must use the hover token instead of a translucent overlay`,
  );
  if (file !== 'ui/tokens.ts') {
    assert.doesNotMatch(content, /\bdark:/, `${file} must not spell out dark: variants; pair them in ui/tokens.ts`);
  }
}

console.log('Vela macOS palette matches the shared brand tokens and passes WCAG AA');
