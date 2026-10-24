import assert from 'node:assert/strict';
import fs from 'node:fs';

const uiRoot = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, uiRoot), 'utf8');
const host = (path) => fs.readFileSync(new URL(`../host/src/${path}`, uiRoot), 'utf8');

function sources(dir) {
  const out = [];
  for (const entry of fs.readdirSync(new URL(dir, uiRoot), { withFileTypes: true })) {
    const relative = `${dir}${entry.name}`;
    if (entry.isDirectory()) out.push(...sources(`${relative}/`));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(relative);
  }
  return out;
}

const app = read('App.tsx');
const atoms = sources('ui/');
const features = sources('features/');
const coreFiles = sources('core/');
const all = [...atoms, ...features, ...coreFiles, 'App.tsx'];
const join = (files) => files.map(read).join('\n');
const featureSource = join(features);
const atomSource = join(atoms);
const controls = host('desktop_controls.rs');
const runner = host('runner.rs');
const main = host('main.rs');

// --- Layering ---------------------------------------------------------------
// Dependencies only point down: shell -> features -> atoms; features -> core.
for (const file of atoms) {
  const source = read(file);
  assert.doesNotMatch(
    source,
    /from ['"]\.\.\/core|from ['"]\.\.\/features|shared\/ui\//,
    `${file}: atoms must not depend on Core, features or product projections`,
  );
}
for (const file of [...features, 'App.tsx']) {
  const source = read(file);
  assert.doesNotMatch(source, /vela\/native|CoreBridge/, `${file}: only core/client.ts talks to Core`);
  assert.doesNotMatch(source, /JSON\.parse/, `${file}: responses are parsed once, in core/client.ts`);
}
for (const file of coreFiles) {
  assert.ok(file.endsWith('.ts'), `${file}: the data layer is plain TypeScript and must not render JSX`);
  assert.doesNotMatch(
    read(file),
    /from ['"]\.\.\/features|from ['"]\.\.\/ui\/(?!index)/,
    `${file}: the data layer must not depend on views`,
  );
}
assert.match(
  read('core/client.ts'),
  /CoreBridge\.request/,
  'core/client.ts must be the single place requests are sent',
);
assert.equal(
  all.filter((file) => /CoreBridge\.request/.test(read(file))).length,
  1,
  'exactly one module may send Core requests',
);

// Features compose atoms; they don't write colors, dark variants or spacing.
for (const file of features) {
  const source = read(file);
  assert.doesNotMatch(source, /#[0-9A-Fa-f]{6}\b/, `${file}: colors come from tokens`);
  assert.doesNotMatch(source, /\bdark:/, `${file}: dark variants are paired in ui/tokens.ts`);
  assert.doesNotMatch(
    source,
    /["`\s](?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|gap|gap-x|gap-y)-\d/,
    `${file}: spacing comes from the spacing tokens`,
  );
  assert.doesNotMatch(source, /min-h-\[/, `${file}: row heights belong to ListRow`);
}

// The shell stays a shell.
// The application menu is a data table the formatter expands one entry per
// line; the shell still holds only navigation, routing and dialogs.
assert.ok(
  app.split('\n').length <= 160,
  `App.tsx is ${app.split('\n').length} lines; it must only hold navigation, routing and dialogs`,
);
for (const file of all) {
  read(file)
    .split('\n')
    .forEach((line, index) => {
      assert.ok(line.length <= 240, `${file}:${index + 1} is ${line.length} characters; split it`);
    });
}

// NSH re-runs bindings, not component bodies: inside a component, values
// derived from props or signals must be getters, or a row keeps showing its
// first state. Plain functions (event handlers) read fresh on every call.
for (const file of [...atoms, ...features]) {
  let component = false;
  for (const line of read(file).split('\n')) {
    const start = line.match(/^(?:export )?function (\w+)/);
    if (start) component = /^[A-Z]/.test(start[1]);
    if (!component) continue;
    // Only component-body statements (two-space indent); locals inside a
    // getter already re-run with it.
    const derived = line.match(/^ {2}const (\w+) = (.*)$/);
    if (!derived) continue;
    const [, name, body] = derived;
    if (!/\bprops\.|\bstore\.\w+\(\)/.test(body)) continue;
    assert.ok(body.startsWith('() =>'), `${file}: ${name} derives from props or signals and must be a getter`);
  }
}

// --- Atoms -------------------------------------------------------------------
for (const atom of [
  'page',
  'card',
  'list',
  'alert',
  'field',
  'switch',
  'sheet',
  'radio-group',
  'log-list',
  'badge',
  'button',
  'avatar',
  'dot',
  'icon-tile',
  'segmented',
]) {
  assert.ok(atoms.includes(`ui/${atom}.tsx`), `the ${atom} atom must exist`);
}
assert.match(read('ui/list.tsx'), /export function ListRow/, 'ListRow must be the shared data row');
assert.equal(
  (atomSource.match(/const frame = `min-h-\[\d+px\] flex-row items-center gap-3 px-4/g) ?? []).length,
  1,
  'the data-row frame must be defined once, in ListRow',
);
// Rows size to their content: a single 13pt line is 18pt tall, so a taller
// minimum is empty padding (the radio row was 44pt, 26pt of it blank).
const rowMinimum = Number(read('ui/list.tsx').match(/const frame = `min-h-\[(\d+)px\]/)[1]);
assert.ok(rowMinimum <= 32, `ListRow's minimum height is ${rowMinimum}pt; a one-line row must stay compact`);
assert.ok(
  rowMinimum >= 28,
  `ListRow's minimum height is ${rowMinimum}pt; it must still fit a 24pt small switch with clearance`,
);
assert.match(read('ui/list.tsx'), /const frame = `[^`]*\bpy-1\.5\b/, "ListRow's vertical padding must stay at 6pt");
const radioMinimum = Number(read('ui/radio-group.tsx').match(/min-h-\[(\d+)px\] flex-row/)[1]);
assert.ok(radioMinimum <= 32, `a radio option is ${radioMinimum}pt tall for one line of text; it must stay compact`);
assert.doesNotMatch(
  featureSource,
  /function \w+Row\(props[^)]*\)\s*\{\s*return <View/,
  'features must build rows from ListRow, not their own View rows',
);
assert.match(read('ui/alert.tsx'), /export function Alert[\s\S]*tone/, 'Alert must take a tone');
assert.match(read('ui/alert.tsx'), /export function Callout/, 'Callout must exist for one-line guidance');
assert.match(
  read('ui/page.tsx'),
  /export function Page[\s\S]*export function PageHeader/,
  'every page shares Page and PageHeader',
);
assert.match(read('ui/switch.tsx'), /nativeComponent[\s\S]*['"]vela\.switch['"]/, 'Switch must be the native NSSwitch');
assert.match(read('ui/sheet.tsx'), /type\.pageTitle/, 'dialogs must share the page title style');

// --- Pages share one shell -----------------------------------------------------
const paneTestIDs = {
  devices: 'devices-view',
  forwards: 'forwards-view',
  logs: 'logs-view',
  account: 'account-view',
  settings: 'settings-view',
};
for (const [pane, testID] of Object.entries(paneTestIDs)) {
  assert.match(
    app,
    new RegExp(`<If when=\\{store\\.pane\\(\\) === ['"]${pane}['"]\\}>`),
    `the ${pane} pane must render only while visible`,
  );
  assert.ok(featureSource.includes(`<Page testID="${testID}"`), `the ${pane} page must use the shared Page shell`);
}
assert.doesNotMatch(app, /classList=\{\{ hidden:/, 'panes must not stay mounted while hidden');
for (const file of features.filter((path) => path.endsWith('Page.tsx'))) {
  assert.doesNotMatch(read(file), /<Scroll /, `${file}: pages scroll through Page, not their own Scroll`);
}
assert.doesNotMatch(
  featureSource,
  /function DetailHeader|text-section/,
  'pages use PageHeader instead of their own header',
);
assert.equal((featureSource.match(/<FormSheet[\s>]/g) ?? []).length, 3, 'all three dialogs share FormSheet');

// --- Navigation and window ------------------------------------------------------
assert.match(app, /Window\.setTitleBar\(['"]default['"]\)/, 'Vela must use the system title bar');
assert.match(app, /class=\{`w-14 border-r/, 'global navigation must be a fixed 56pt icon rail');
assert.match(
  app,
  /pane: ['"]devices['"][\s\S]*pane: ['"]forwards['"][\s\S]*pane: ['"]logs['"][\s\S]*bottom: true[\s\S]*pane: ['"]account['"][\s\S]*pane: ['"]settings['"]/,
  'devices and forwards on top; logs, account and settings at the bottom',
);
for (const [key, label] of [
  ['mod+1', '设备'],
  ['mod+2', '转发'],
  ['mod+3', '日志'],
  ['mod+4', '账户'],
]) {
  const shortcut = key.replaceAll('+', '\\+');
  assert.match(
    app,
    new RegExp(`label: ['"]${label}['"], shortcut: ['"]${shortcut}['"]`),
    `${label} must keep its ${key} shortcut`,
  );
}
assert.doesNotMatch(
  app,
  /role: ['"]zoom['"]|role: ['"]toggleFullScreen['"]/,
  'a fixed window must not offer zoom or full screen',
);
assert.match(main, /size: \(480, 960\)/, 'the window must be a fixed portrait utility window');
assert.doesNotMatch(runner, /NSWindowStyleMask::Resizable/, 'the window must not be resizable');
assert.match(runner, /NSWindowButton::ZoomButton[\s\S]{0,60}setHidden\(true\)/, 'the dead zoom button must be hidden');
assert.match(runner, /SWITCH_COMPONENT/, 'the native switch must be registered');

// --- Devices ---------------------------------------------------------------------
const devices = join(features.filter((file) => file.startsWith('features/devices/')));
assert.doesNotMatch(devices, /title="删除"/, 'a device list row must not carry a destructive action');
const remoteRow = devices.slice(devices.indexOf('function RemoteDeviceRow('), devices.indexOf('function LocalDetail('));
assert.match(remoteRow, /<IconTile symbol="desktopcomputer" \/>/, 'a device row leads with the icon tile');
assert.match(remoteRow, /connectionLabel\(props\.device\.connection\)[\s\S]{0,40}个服务/, 'a row says 状态 · N 个服务');
assert.match(remoteRow, /<Dot tone=/, 'a row carries the status dot');
assert.doesNotMatch(remoteRow, /deviceAddressLines|Badge/, 'the list row must not repeat addresses or a status badge');
assert.match(devices, /deviceAddressLines/, 'the device detail pages keep the addresses');
assert.match(devices, /还没有添加其他设备/, 'the empty state names the devices it would list');
assert.match(devices, /title="删除设备"[\s\S]{0,80}variant="danger"/, 'deleting a device lives on its detail page');
assert.doesNotMatch(
  devices,
  /其他 Mac（|添加 Mac|还没有添加其他 Mac/,
  'the list does not switch to Mac-only vocabulary',
);

// --- Booleans are switches -----------------------------------------------------------
assert.doesNotMatch(
  featureSource,
  /['"]已开启['"]\s*:\s*['"]已关闭['"]|\?\s*['"]关闭['"]\s*:\s*['"]开启['"]|\?\s*['"]停止共享['"]\s*:\s*['"]开始共享['"]/,
  'booleans must not be a state label plus an opposite button',
);
for (const label of ['共享这台 Mac', '性能 HUD', '详细日志']) {
  assert.ok(new RegExp(`<Switch[^>]*label="${label}"`).test(featureSource), `${label} must be a switch`);
}
assert.match(featureSource, /<Switch[\s\S]{0,200}setServiceShared/, 'per-service sharing must be a switch');

// --- A forward is a switch plus an endpoint ---------------------------------------------
// Forwarding is a long-lived boolean, so it is a switch, not start/stop buttons.
// Once on, the address is the row's subject: it sits in an Endpoint block with
// the full row width, the link rail is its only status mark, and its only
// actions are two icons inside the block.
const forwardRow = read('features/forwards/ForwardRow.tsx');
const endpoint = read('ui/endpoint.tsx');
assert.match(forwardRow, /<Switch[\s\S]{0,200}onChange=\{toggle\}/, 'a forward is turned on and off with a switch');
assert.doesNotMatch(
  featureSource,
  /['"](?:开始转发|停止转发)['"]/,
  'forwarding must not be a pair of start/stop buttons',
);
assert.match(
  forwardRow,
  /footer=\{[\s\S]{0,80}<Endpoint/,
  'a live forward shows its address in an Endpoint below the title',
);
assert.doesNotMatch(forwardRow, /转发中/, 'the link rail is the only status mark; no duplicate 转发中 badge');
assert.match(endpoint, /<LinkTrack/, 'the Endpoint carries the link rail');
assert.equal(
  (endpoint.match(/iconOnly/g) ?? []).length,
  2,
  'a live forward has exactly two icon actions: open and copy',
);
// Measured: a real address needs up to 265pt. With actions inside the well it
// had 242pt; with only the rail beside it, 314pt. The well holds the address.
const well = endpoint.slice(
  endpoint.indexOf('export function Endpoint('),
  endpoint.indexOf('export function EndpointActions'),
);
assert.doesNotMatch(
  well,
  /iconOnly/,
  'the address well must not hold icon actions; they would truncate real addresses',
);
assert.match(
  forwardRow,
  /trailing=\{[\s\S]{0,200}<EndpointActions/,
  "a live forward's actions sit on the title line beside its switch",
);
assert.match(forwardRow, /forwardEndpoint\(url\(\)\)/, 'the address is shown as host:port without a scheme');
for (const file of ['features/devices/DevicesPage.tsx', 'features/forwards/ForwardsPage.tsx']) {
  assert.match(read(file), /<ForwardRow /, `${file}: both pages render forwards with the same ForwardRow`);
}
assert.doesNotMatch(featureSource, /function RemoteServiceRow/, 'the old per-page forward rows must be gone');
assert.match(
  read('core/store.ts'),
  /const current = \(\) => [^\n]*=== attempt/,
  'turning a switch off mid-connect must not let a stale attempt revive the row',
);

// --- Forwarding by protocol ------------------------------------------------------------
assert.match(endpoint, /title="在浏览器中打开"/, 'HTTP forwards open in the browser');
assert.match(forwardRow, /onOpen=\{web\(\) \? open : undefined\}/, 'only web forwards offer to open in the browser');
assert.match(featureSource, /connectionCommand\(/, 'TCP forwards show a connection command');
assert.match(
  read('core/store.ts'),
  /if \(isWeb\) core\.openExternal\(url\)/,
  'only HTTP forwards are handed to the browser',
);
assert.match(forwardRow, /['"]复制地址['"]/, "a web forward's address must be copyable");
assert.match(
  forwardRow,
  /复制命令：\$\{command\(\)\}/,
  'a TCP forward copies its full command, and the tooltip says so',
);
assert.doesNotMatch(featureSource, /DSH Web 认证/, 'the device that forwards DSH never asks for its token');
assert.match(featureSource, /DSH 输出日志/, 'the DSH sign-in log is configured where DSH is shared');

// --- Services by protocol ---------------------------------------------------------------
const editor = join(features.filter((file) => file.startsWith('features/services/')));
assert.match(
  editor,
  /presetOptions\(['"]web['"][\s\S]*presetOptions\(['"]tcp['"]/,
  'presets are grouped into Web and TCP',
);
assert.doesNotMatch(editor, /Menu\.popup/, 'presets must be visible radio options, not a popup');

// --- Logs read like logs ------------------------------------------------------------------
const logs = join(features.filter((file) => file.startsWith('features/logs/')));
assert.match(logs, /<LogList/, 'the logs page renders a log, not a settings list');
assert.match(logs, /logLevelCounts\(/, 'the logs page must filter by level');
assert.match(logs, /<Segmented/, 'log levels use the same segmented control as appearance');
assert.match(logs, /复制日志/, 'the logs page copies the visible lines');
assert.match(logs, /暂无日志/, 'an empty journal says so');
assert.match(logs, /该级别没有记录/, 'a filtered-out level is distinguished from an empty journal');
assert.match(read('ui/log-list.tsx'), /w-\[58px\] \$\{type\.mono\}/, 'log time must be a fixed monospace column');
assert.match(read('ui/tokens.ts'), /mono: ['"]font-mono/, 'the mono type token must use the monospace face');

// --- Identity is separate from preferences ------------------------------------------------
const settings = read('features/settings/SettingsPage.tsx');
const account = read('features/account/AccountPage.tsx');
assert.doesNotMatch(settings, /注销|signIn|logout|私人连接/, 'settings holds preferences only');
assert.match(account, /logout/, 'sign-out lives on the account page');
assert.match(account, /<Avatar [^>]*large/, 'the account page leads with the avatar identity header');
assert.doesNotMatch(account, /<ListRow[^>]*title="账户"/, 'the account name appears only once, in the identity header');
assert.match(
  account,
  /title="私人连接"[\s\S]{0,900}title="这台 Mac 的身份"[\s\S]{0,900}title="登录"/,
  'the account sections run 私人连接 → 设备身份 → 登录',
);
assert.match(
  account,
  /store\.needsAuth\(\)[\s\S]{0,700}title="重新登录"[\s\S]{0,100}store\.account\.signIn/,
  'a revoked identity must expose the interactive sign-in action',
);
assert.match(
  read('core/store.ts'),
  /next\.network === ['"]connected['"] \|\| next\.network === ['"]needs-auth['"][\s\S]{0,100}authPending\.set\(false\)/,
  'settling at needs-auth must clear the old browser-login attempt',
);
assert.match(settings, /diagnosticSummaryRows/, 'diagnostics are shown by default');
assert.match(settings, /testID="copy-diagnostics"/, 'diagnostics stay copyable');
assert.match(settings, /title="关于"[\s\S]{0,500}APP_VERSION/, '关于 shows the shared application version');
assert.match(settings, /store\.protocolVersion\(\)/, 'the protocol number comes from Core, not a constant');
assert.doesNotMatch(settings, /PROTOCOL_VERSION|协议 v2/, 'the hardcoded protocol version is gone');
assert.match(
  settings,
  /title="外观"[\s\S]*title="共享"[\s\S]*title="通用"[\s\S]*title="隐私"[\s\S]*title="诊断"[\s\S]*title="关于"/,
  'settings sections run 外观 → 共享 → 通用 → 隐私 → 诊断 → 关于',
);
assert.match(settings, /<Segmented/, 'appearance uses the segmented control');
assert.match(settings, /使用 Gravatar 头像/, 'Gravatar is a setting on both platforms');

// --- Guidance uses Alert and Callout ----------------------------------------------------------
assert.match(featureSource, /<Alert /, 'conditions needing attention use Alert');
assert.match(featureSource, /<Callout>/, 'one-line guidance uses Callout');
for (const file of features) {
  for (const match of read(file).matchAll(/<Text[^>]*>([^<{]{40,})<\/Text>/g)) {
    assert.fail(`${file}: long guidance "${match[1].slice(0, 30)}…" must be an Alert or Callout`);
  }
}

// --- Native button behaviour ---------------------------------------------------------------------
assert.match(controls, /fn accent_color\(\)/, "primary buttons use Vela's accent");
assert.doesNotMatch(controls, /NSColor::controlAccentColor/, 'Vela must not fall back to the system accent');
assert.match(controls, /setAttributedTitle/, 'button titles are colored through attributedTitle');
assert.match(
  controls,
  /NoCellMask/,
  'a disabled button suppresses its press highlight instead of letting AppKit fade it',
);
assert.match(controls, /setAccessibilityEnabled/, 'a disabled button reports itself unavailable to VoiceOver');

console.log('Vela layered UI structure, design rules and native controls match the approved design');
