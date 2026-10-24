import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

function sources(dir) {
  const out = [];
  for (const entry of fs.readdirSync(new URL(dir, root), { withFileTypes: true })) {
    const relative = `${dir}${entry.name}`;
    if (entry.isDirectory()) out.push(...sources(`${relative}/`));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(relative);
  }
  return out;
}

const atoms = sources('ui/').filter((file) => !file.endsWith('tokens.ts'));
const features = sources('features/');
const tokens = read('ui/tokens.ts');
const nativeWebView = read('../host/src/webview.rs');

// Layering: atoms are generic; only core/client.ts talks to Core.
for (const file of atoms) {
  assert.doesNotMatch(
    read(file),
    /(?:^|\/)core\/|features\/|shared\/ui\//,
    `${file}: atoms must not depend on Core, features or projections`,
  );
}
for (const file of [...features, 'App.tsx']) {
  const source = read(file);
  assert.doesNotMatch(source, /from ['"]vela\/native['"]|CoreBridge/, `${file}: only core/client.ts talks to Core`);
  assert.doesNotMatch(source, /JSON\.parse/, `${file}: responses are parsed once, in core/client.ts`);
}

// Colors, spacing and type sizes come from tokens. Features and atoms never
// write hex, raw spacing utilities or raw text sizes; only tokens.ts does.
for (const file of [...atoms, ...features, 'App.tsx']) {
  const source = read(file);
  assert.doesNotMatch(source, /#[0-9A-Fa-f]{6}\b/, `${file}: colors come from tokens`);
  assert.doesNotMatch(
    source,
    /["'`\s](?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)-\d/,
    `${file}: spacing comes from tokens (inset/size)`,
  );
  assert.doesNotMatch(source, /["'`\s]text-(?:xs|sm|base|lg|xl|\d)/, `${file}: type sizes come from font tokens`);
  assert.doesNotMatch(source, /\bdark:/, `${file}: dark variants are paired in tokens.ts`);
}

// One horizontal inset per container: the page owns 16pt, a cell owns 16pt.
assert.match(tokens, /screen: ['"]px-4['"]/, 'pages own a 16pt screen inset');
assert.match(tokens, /cell: ['"]px-4['"]/, 'cells own a 16pt text inset');
assert.doesNotMatch(
  read('ui/chrome.tsx'),
  /Sheet[\s\S]*contentClass=\{`grow \$\{inset\.screen\} \$\{inset\.cell\}/,
  'sheets must not stack page and cell insets',
);

// iOS conventions.
assert.ok(read('ui/chrome.tsx').includes('presentation="pageSheet"'), 'secondary pages are native page sheets');
const shell = read('features/shell/Shell.tsx');
assert.ok(shell.includes('<FloatingTabBar'), 'sections are reached through the floating tab bar');
assert.deepEqual(
  [...shell.matchAll(/\{ id: ['"](\w+)['"], label/g)].map((m) => m[1]),
  ['devices', 'services', 'logs', 'me', 'settings'],
  'tab order: 设备 服务 日志 我的 设置',
);
assert.ok(shell.includes('<BottomMenu'), "the browser's ⋯ menu is the bottom menu");
assert.ok(
  read('ui/menu.tsx').includes('side="bottom"') && read('ui/menu.tsx').includes('w-full'),
  'the bottom menu is full width and attached to the bottom edge',
);
assert.ok(read('ui/float.tsx').includes('safeAreaInsets'), 'floating chrome clears the home indicator');
assert.doesNotMatch(
  read('ui/float.tsx'),
  /floatSelected|active\(\) \? surface/,
  'an active tab changes its symbol and label color, not its background',
);
assert.ok(
  read('features/services/BrowserPage.tsx').includes('<BrowserToolbar'),
  'the browser controls sit in a bottom toolbar',
);
assert.ok(read('ui/float.tsx').includes('props.collapsed'), 'the toolbar collapses to an indicator');
assert.ok(read('features/services/BrowserPage.tsx').includes('onScroll'), 'page scrolling drives the toolbar');
// UIKit owns keyboard geometry through UIKeyboardLayoutGuide. Native keyboard
// notifications and WebKit frame/inset/offset fixes desynchronise its layout
// and visual viewports on iOS 26.
assert.doesNotMatch(
  nativeWebView,
  /UIKeyboard(?:Will|Did)|keyboardChanged:/,
  'the WebView must not resize or inset itself from keyboard notifications',
);
assert.match(nativeWebView, /keyboardLayoutGuide/, "the WebView bottom follows UIKit's keyboard layout guide");
assert.doesNotMatch(
  nativeWebView,
  /obscuredContentInsets|setContentInset:|setContentOffset:|visualViewport/,
  "keyboard layout must not mutate WebKit's viewport or scroll state",
);
assert.match(
  read('features/services/BrowserPage.tsx'),
  /bottomInset=\{browserViewportBottom\}/,
  'toolbar collapse must not resize the WebView viewport',
);
assert.match(
  tokens,
  /browserViewportBottom = floatClearance\.toolbar \+ 12/,
  'the browser toolbar has background padding above it',
);
assert.match(nativeWebView, /themeColor/, "browser bands follow WKWebView's semantic theme color");
assert.match(
  nativeWebView,
  /underPageBackgroundColor/,
  'pages without a theme color fall back to their under-page color',
);
assert.doesNotMatch(
  nativeWebView,
  /getComputedStyle\([^)]*\)\.backgroundColor|canvas\.fillStyle/,
  'browser chrome must not sample page pixels or CSS colors',
);
for (const page of [
  'services/ServicesPage.tsx',
  'devices/DeviceSheets.tsx',
  'logs/LogsPage.tsx',
  'settings/SettingsPage.tsx',
  'account/MePage.tsx',
]) {
  assert.ok(read(`features/${page}`).includes('<TabPage'), `${page} is a tab page that clears the tab bar`);
}
// Every tab page uses the same fixed header: title/summary left, actions right.
assert.ok(read('ui/chrome.tsx').includes('props.actions'), 'tab pages share one header');
for (const page of [
  'services/ServicesPage.tsx',
  'devices/DeviceSheets.tsx',
  'logs/LogsPage.tsx',
  'settings/SettingsPage.tsx',
  'account/MePage.tsx',
]) {
  assert.doesNotMatch(read(`features/${page}`), /summary=/, `${page}: the header shows only the title and actions`);
}
assert.ok(read('features/services/ServicesPage.tsx').includes('<Wordmark'), 'the home tab shows the Vela mark');
assert.match(tokens, /brand: 28/, 'the service-page logo matches the 28pt page-title line height');
const homeActions = read('features/services/ServicesPage.tsx').match(/actions=\{[^\n]*\n?/)?.[0] ?? '';
assert.doesNotMatch(homeActions, /添加 Mac/, 'the home header has no add action');
assert.doesNotMatch(
  read('features/logs/LogsPage.tsx'),
  /diagnosticSummaryRows|diagnosticsActions\.copy\b/,
  'the logs tab shows and copies logs, not diagnostics',
);
assert.ok(read('features/logs/LogsPage.tsx').includes('diagnosticsActions.copyLogs'), '复制日志 copies the log lines');
assert.match(
  read('features/settings/SettingsPage.tsx'),
  /使用 Gravatar 头像/,
  'Gravatar is an explicit settings choice',
);
assert.match(read('features/settings/SettingsPage.tsx'), /默认关闭/, 'the Gravatar setting discloses its default');
assert.match(
  read('ui/status.tsx'),
  /<Text[\s\S]*<If when=\{props\.imageUrl\}>/,
  'the avatar image keeps the initial underneath as its failure fallback',
);
// Sheets share the tab pages' frame: left 22pt title, actions on the right.
assert.ok(
  read('ui/chrome.tsx').match(/export function PageSheet[\s\S]*?font\.pageTitle/),
  "page sheets use the tab pages' title",
);
for (const file of features) {
  for (const tag of read(file).matchAll(/<PageSheet[^>]*?testID=/g)) {
    assert.doesNotMatch(tag[0], /\b(leading|trailing)=/, `${file}: sheets use cancel/confirm/actions`);
  }
}
const menu = shell.slice(shell.indexOf('function browserMenu'), shell.indexOf('export function Shell'));
assert.deepEqual(
  [...menu.matchAll(/label: ['"]([^'"]+)['"]/g)].map((m) => m[1]),
  ['设备信息', '服务列表', '重新加载', '关闭服务'],
  'the service menu keeps four actions',
);
assert.ok(read('ui/native.tsx').includes('vela/symbol'), 'icons are SF Symbols');
assert.ok(read('ui/native.tsx').includes('vela/switch'), 'toggles are UISwitch');
assert.match(tokens, /touch: ['"]min-h-11 min-w-11['"]/, 'touch targets are at least 44pt');

// Every modal has exactly one owner sheet and closes through the stack.
for (const modal of ['rename', 'device', 'add']) {
  const owners = features.filter((file) => new RegExp(`isOpen\\(['"]${modal}['"]\\)`).test(read(file)));
  assert.equal(owners.length, 1, `modal ${modal} must have exactly one sheet`);
  assert.match(
    read(owners[0]),
    new RegExp(`dismiss\\(['"]${modal}['"]\\)`),
    `modal ${modal} closes through the modal stack`,
  );
}

// The shell stays a shell.
assert.ok(read('App.tsx').split('\n').length <= 40, 'App.tsx only mounts the shell and sheets');
for (const file of [...atoms, ...features]) {
  read(file)
    .split('\n')
    .forEach((line, index) => assert.ok(line.length <= 240, `${file}:${index + 1} is too long`));
}

// Type scale: a 14pt base and nothing else. Line heights land on 4pt.
const fontSize = JSON.parse(read('nsh.json')).tailwind.fontSize;
assert.equal(fontSize.base[0], 14, 'the base size is 14pt');
assert.deepEqual(
  Object.values(fontSize)
    .map(([px]) => px)
    .sort((a, b) => a - b),
  [11, 12, 14, 16, 18, 22],
  'one scale: 11 · 12 · 14 · 16 · 18 · 22',
);
for (const [name, [px, ratio]] of Object.entries(fontSize)) {
  assert.ok(
    Math.abs((px * ratio) % 2) < 0.05 || Math.abs(((px * ratio) % 2) - 2) < 0.05,
    `${name} line height ${px * ratio}pt is off the 2pt grid`,
  );
}
// Symbols are sized by role, never by a literal.
for (const file of [...atoms, ...features]) {
  assert.doesNotMatch(read(file), /size=\{\d+\}/, `${file}: symbol sizes come from the symbol tokens`);
}

// Every light color has a dark counterpart.
const theme = JSON.parse(read('nsh.json')).tailwind.colors;
for (const name of Object.keys(theme)) {
  if (!name.startsWith('dk-')) assert.ok(`dk-${name}` in theme, `nsh.json is missing dk-${name}`);
}

console.log('Vela iOS structure and design rules passed');
