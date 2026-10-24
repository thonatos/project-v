import assert from 'node:assert/strict';
import fs from 'node:fs';

const theme = JSON.parse(fs.readFileSync(new URL('../nsh.json', import.meta.url), 'utf8')).tailwind.colors;

const base = JSON.parse(fs.readFileSync(new URL('../../../shared/tokens/base.json', import.meta.url), 'utf8'));

// Brand colors both platforms share: one edit in base.json moves both apps.
for (const [scheme, prefix] of [
  ['light', ''],
  ['dark', 'dk-'],
]) {
  for (const [key, value] of Object.entries(base[scheme])) {
    assert.equal(
      (theme[`${prefix}${key}`] ?? '').toUpperCase(),
      value.toUpperCase(),
      `${prefix}${key} must match shared/tokens/base.json`,
    );
  }
}

function luminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((index) => {
    const channel = parseInt(value.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// [ink, surface, minimum]. Body text 4.5:1; secondary labels on cells 4.5:1;
// tertiary (chevrons, timestamps) 3:1 as non-text UI.
const pairs = [
  ['canvas-foreground', 'canvas', 4.5],
  ['canvas-foreground', 'cell', 4.5],
  ['secondary', 'cell', 4.5],
  ['secondary', 'canvas', 4.5],
  ['tertiary', 'cell', 3],
  ['accent', 'cell', 4.5],
  ['accent', 'canvas', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['accent', 'accent-soft', 4.5],
  ['success', 'success-soft', 4.5],
  ['warning', 'warning-soft', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['danger', 'cell', 4.5],
  ['secondary', 'offline-soft', 4.5],
  ['hue1', 'hue1-soft', 4.5],
  ['hue2', 'hue2-soft', 4.5],
  ['hue3', 'hue3-soft', 4.5],
  ['hue4', 'hue4-soft', 4.5],
  ['hue5', 'hue5-soft', 4.5],
];

for (const [ink, surface, minimum] of pairs) {
  for (const prefix of ['', 'dk-']) {
    const ratio = contrast(theme[`${prefix}${ink}`], theme[`${prefix}${surface}`]);
    assert.ok(ratio >= minimum, `${prefix}${ink} on ${prefix}${surface} is ${ratio.toFixed(2)}:1, below ${minimum}:1`);
  }
}

// The two appearances are distinct and cells lift off the canvas in both.
assert.ok(luminance(theme.canvas) > 0.8 && luminance(theme['dk-canvas']) < 0.02, 'canvas must be light/dark');
assert.ok(luminance(theme.cell) > luminance(theme.canvas), 'light cells sit above the grouped canvas');
assert.ok(luminance(theme['dk-cell']) > luminance(theme['dk-canvas']), 'dark cells sit above the grouped canvas');

console.log('Vela iOS palette contrast passed');
