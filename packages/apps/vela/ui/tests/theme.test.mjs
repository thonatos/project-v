import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../theme.ts", import.meta.url), "utf8");
const nsh = JSON.parse(fs.readFileSync(new URL("../nsh.json", import.meta.url), "utf8"));

assert.match(source, /half: 4,[\s\S]*x1: 8,[\s\S]*compact: 12,[\s\S]*x2: 16,[\s\S]*x3: 24,[\s\S]*section: 28,[\s\S]*x4: 32/, "spacing must follow the 4pt desktop grid");
assert.match(source, /toolbar: 48,[\s\S]*navigation: 56,[\s\S]*row: 56/, "desktop layout dimensions must be tokenized");
assert.match(source, /\.AppleSystemUIFont/, "display and body must use the macOS system family");
assert.match(source, /monospace/, "utility text must use the platform monospace family");

/** Reads one palette out of `theme.ts` without importing TypeScript. */
function palette(name) {
  const block = source.match(new RegExp(`${name}: \\{([\\s\\S]*?)\\n  \\}`));
  assert.ok(block, `theme.ts must define the ${name} palette`);
  return Object.fromEntries([...block[1].matchAll(/(\w+): "(#[0-9A-Fa-f]{6})"/g)].map((match) => [match[1], match[2].toUpperCase()]));
}

const light = palette("light");
const dark = palette("dark");

/**
 * Every surface must be paired with a foreground, following shadcn/ui's token
 * contract, so no view has to invent a readable color of its own.
 */
for (const [name, values] of [["light", light], ["dark", dark]]) {
  for (const surface of ["canvas", "surface", "sidebar", "subtle", "accent"]) {
    assert.ok(values[surface], `${name}.${surface} must exist`);
    assert.ok(values[`${surface}Foreground`], `${name}.${surface} must be paired with ${surface}Foreground`);
  }
}
assert.deepEqual(Object.keys(light), Object.keys(dark), "both palettes must define the same tokens");

function luminance(value) {
  const channels = value.slice(1).match(/../g).map((part) => Number.parseInt(part, 16) / 255).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function ratio(a, b) {
  const [bright, dim] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (bright + 0.05) / (dim + 0.05);
}

/**
 * Contrast is checked against the palette itself rather than a copied list, so
 * a future color change cannot silently drop below AA.
 */
const foregrounds = ["text", "muted", "accent", "success", "warning", "danger", "offline"];
for (const [name, values] of [["light", light], ["dark", dark]]) {
  for (const key of foregrounds) {
    for (const background of ["surface", "canvas"]) {
      const measured = ratio(values[key], values[background]);
      assert.ok(measured >= 4.5, `${name}.${key} on ${name}.${background} is ${measured.toFixed(2)}:1 and must meet WCAG AA`);
    }
  }
  for (const key of ["sidebarForeground", "sidebarSubtle"]) {
    const measured = ratio(values[key], values.sidebar);
    assert.ok(measured >= 4.5, `${name}.${key} on the sidebar is ${measured.toFixed(2)}:1 and must meet WCAG AA`);
  }
  const accentOnAccent = ratio(values.accentForeground, values.accent);
  assert.ok(accentOnAccent >= 4.5, `${name} accent foreground is ${accentOnAccent.toFixed(2)}:1 and must meet WCAG AA`);
}

/**
 * The navigation must remain a readable layer. This palette separates it from
 * the canvas by a small tone step plus a hairline border rather than by
 * inverting it, because an inverted rail forces the AppKit controls inside it
 * away from the system appearance and leaves untinted icons unreadable.
 */
const shell = fs.readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
for (const [name, values] of [["light", light], ["dark", dark]]) {
  const separation = ratio(values.sidebar, values.canvas);
  assert.notEqual(values.sidebar, values.canvas, `${name} sidebar must not be identical to the canvas`);
  assert.ok(separation >= 1.03, `${name} sidebar must be a perceptible layer, got ${separation.toFixed(2)}:1`);
  assert.ok(separation <= 1.6, `${name} sidebar must stay in the canvas family so native icons follow the system appearance, got ${separation.toFixed(2)}:1`);
  const railForeground = ratio(values.sidebarForeground, values.sidebar);
  assert.ok(railForeground >= 4.5, `${name} rail foreground is ${railForeground.toFixed(2)}:1 and must meet WCAG AA`);
}
assert.match(shell, /class={`w-14 border-r/, "the navigation rail must be separated by a hairline border");

/** Tailwind must expose both schemes so components never inline a hex value. */
const colors = nsh.tailwind.colors;
for (const key of Object.keys(colors).filter((name) => !name.startsWith("dk-"))) {
  assert.ok(colors[`dk-${key}`], `nsh.json must pair ${key} with dk-${key}`);
}

/**
 * Disabled controls and alert tones carry their own measured pairs. A disabled
 * button keeps readable ink on its own bezel instead of fading into a colored
 * one, and every alert tone keeps its text legible on its tinted surface.
 */
for (const [name, values] of [["light", light], ["dark", dark]]) {
  const disabled = ratio(values.disabledForeground, values.disabled);
  assert.ok(disabled >= 4.5, `${name} disabled ink is ${disabled.toFixed(2)}:1 on its bezel and must meet WCAG AA`);
  for (const [tone, surface, foreground] of [
    ["info", "infoSurface", "infoForeground"],
    ["success", "successSurface", "successSurfaceForeground"],
    ["warning", "warningSurface", "warningSurfaceForeground"],
    ["danger", "dangerSurface", "dangerSurfaceForeground"],
  ]) {
    assert.ok(values[surface] && values[foreground], `${name}.${tone} alert must define a surface and its ink`);
    const measured = ratio(values[foreground], values[surface]);
    assert.ok(measured >= 4.5, `${name} ${tone} alert text is ${measured.toFixed(2)}:1 and must meet WCAG AA`);
    assert.notEqual(values[surface], values.canvas, `${name} ${tone} alert must be distinguishable from the canvas`);
  }
}

/**
 * Hex values live only in theme.ts and nsh.json, and `dark:` variants only in
 * the token module. Every other UI source composes tokens.
 */
const uiRoot = new URL("../", import.meta.url);
function sources(dir) {
  const out = [];
  for (const entry of fs.readdirSync(new URL(dir, uiRoot), { withFileTypes: true })) {
    const relative = `${dir}${entry.name}`;
    if (entry.isDirectory()) {
      if (!["tests", ".nsh", "node_modules"].includes(entry.name)) out.push(...sources(`${relative}/`));
    } else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(relative);
    }
  }
  return out;
}
const files = sources("");
assert.ok(files.length > 10, "the theme check must see the whole UI tree");
for (const file of files) {
  if (file === "theme.ts") continue;
  const content = fs.readFileSync(new URL(file, uiRoot), "utf8");
  assert.doesNotMatch(content, /#[0-9A-Fa-f]{6}\b/, `${file} must use semantic tokens instead of hex colors`);
  assert.doesNotMatch(content, /bg-black\/|bg-white\//, `${file} must use the hover token instead of a translucent overlay`);
  if (file !== "ui/tokens.ts") {
    assert.doesNotMatch(content, /\bdark:/, `${file} must not spell out dark: variants; pair them in ui/tokens.ts`);
  }
}

console.log("Vela theme tokens pass pairing, 4pt, system-font and WCAG AA checks");
