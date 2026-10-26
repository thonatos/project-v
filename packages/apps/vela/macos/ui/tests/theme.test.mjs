import assert from 'node:assert/strict';
import fs from 'node:fs';

const nsh = JSON.parse(fs.readFileSync(new URL('../nsh.json', import.meta.url), 'utf8'));
const theme = nsh.theme.cssVars;
const base = JSON.parse(fs.readFileSync(new URL('../../../shared/tokens/base.json', import.meta.url), 'utf8'));

function color(key, scheme = 'light') {
  const value = theme[scheme][key];
  assert.ok(value, `nsh.json theme must define ${scheme}.${key}`);
  return value.toUpperCase();
}

function luminance(value) {
  const channels = value.slice(1).match(/../g).map((part) => Number.parseInt(part, 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function ratio(a, b) {
  const [bright, dim] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (bright + 0.05) / (dim + 0.05);
}

for (const scheme of ['light', 'dark']) {
  for (const [key, value] of Object.entries(base[scheme])) {
    assert.equal(color(key, scheme), value.toUpperCase(), `${scheme}.${key} must match shared/tokens/base.json`);
  }
}

for (const surface of ['canvas', 'surface', 'sidebar', 'subtle', 'accent']) {
  for (const scheme of ['light', 'dark']) {
    assert.ok(theme[scheme][surface], `nsh.json must define ${scheme}.${surface}`);
    assert.ok(theme[scheme][`${surface}-foreground`], `${scheme}.${surface} must have a foreground`);
  }
}

const foregrounds = ['text', 'muted-foreground', 'accent', 'success', 'warning', 'danger', 'offline'];
for (const scheme of ['light', 'dark']) {
  for (const key of foregrounds) {
    for (const background of ['surface', 'canvas']) {
      const measured = ratio(color(key, scheme), color(background, scheme));
      assert.ok(measured >= 4.5, `${scheme}.${key} on ${background} is ${measured.toFixed(2)}:1`);
    }
  }
  for (const key of ['sidebar-foreground', 'sidebar-subtle']) {
    const measured = ratio(color(key, scheme), color('sidebar', scheme));
    assert.ok(measured >= 4.5, `${scheme}.${key} on sidebar is ${measured.toFixed(2)}:1`);
  }
  assert.ok(ratio(color('accent-foreground', scheme), color('accent', scheme)) >= 4.5);
  for (const [tone, text, surface] of [
    ['info', 'info-foreground', 'info-surface'], ['success', 'success-surface-foreground', 'success-surface'],
    ['warning', 'warning-surface-foreground', 'warning-surface'], ['danger', 'danger-surface-foreground', 'danger-surface'],
  ]) {
    const measured = ratio(color(text, scheme), color(surface, scheme));
    assert.ok(measured >= 4.5, `${scheme}.${tone} alert text is ${measured.toFixed(2)}:1`);
    assert.notEqual(color(surface, scheme), color('canvas', scheme), `${scheme}.${tone} alert must stand out`);
  }
}

const uiRoot = new URL('../', import.meta.url);
function sources(dir) {
  const out = [];
  for (const entry of fs.readdirSync(new URL(dir, uiRoot), { withFileTypes: true })) {
    const relative = `${dir}${entry.name}`;
    if (entry.isDirectory()) {
      if (!['tests', '.nsh', 'node_modules'].includes(entry.name)) out.push(...sources(`${relative}/`));
    } else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(relative);
  }
  return out;
}
const files = sources('');
assert.ok(files.length > 10);
for (const file of files) {
  const content = fs.readFileSync(new URL(file, uiRoot), 'utf8');
  assert.doesNotMatch(content, /#[0-9A-Fa-f]{6}\b/, `${file} must use runtime semantic tokens`);
  assert.doesNotMatch(content, /\bdark:/, `${file} must let runtime theme tokens resolve appearance`);
}
console.log('Vela macOS runtime theme matches shared tokens and passes WCAG AA');
