import assert from 'node:assert/strict';
import fs from 'node:fs';

const theme = JSON.parse(fs.readFileSync(new URL('../nsh.json', import.meta.url), 'utf8')).theme.cssVars;
const base = JSON.parse(fs.readFileSync(new URL('../../../shared/tokens/base.json', import.meta.url), 'utf8'));

for (const scheme of ['light', 'dark']) {
  for (const [key, value] of Object.entries(base[scheme])) {
    assert.equal(
      (theme[scheme][key] ?? '').toUpperCase(),
      value.toUpperCase(),
      `${scheme}.${key} must match shared tokens`,
    );
  }
}

function luminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((index) => {
    const channel = Number.parseInt(value.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
const contrast = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
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
for (const [ink, surface, minimum] of pairs)
  for (const scheme of ['light', 'dark']) {
    const measured = contrast(theme[scheme][ink], theme[scheme][surface]);
    assert.ok(measured >= minimum, `${scheme}.${ink} on ${surface} is ${measured.toFixed(2)}:1`);
  }

assert.deepEqual(Object.keys(theme.light).sort(), Object.keys(theme.dark).sort(), 'appearances expose the same roles');
assert.ok(luminance(theme.light.canvas) > 0.8 && luminance(theme.dark.canvas) < 0.02);
assert.ok(luminance(theme.light.cell) > luminance(theme.light.canvas));
assert.ok(luminance(theme.dark.cell) > luminance(theme.dark.canvas));
assert.doesNotMatch(fs.readFileSync(new URL('../ui/tokens.ts', import.meta.url), 'utf8'), /\bdark:/);
assert.doesNotMatch(fs.readFileSync(new URL('../ui/native.tsx', import.meta.url), 'utf8'), /#[0-9a-f]{6}/i);

console.log('Vela iOS runtime theme matches shared tokens and passes WCAG AA');
