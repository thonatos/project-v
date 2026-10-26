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
const core = sources('core/');
const appFiles = [...atoms, ...features, ...core, 'App.tsx'];

// Stable dependency boundaries: atoms are presentation-only; features cannot
// bypass the platform client or parse the protocol themselves.
for (const file of atoms) {
  assert.doesNotMatch(
    read(file),
    /(?:^|\/)core\/|features\/|shared\/ui\//,
    `${file}: UI atoms must not depend on Core, features or product projections`,
  );
}
for (const file of [...features, 'App.tsx']) {
  const source = read(file);
  assert.doesNotMatch(source, /from ['"]vela\/native['"]|CoreBridge/, `${file}: only core/client.ts may access the native bridge`);
  assert.doesNotMatch(source, /JSON\.parse/, `${file}: only the client/data boundary parses Core responses`);
}

const bridgeSenders = appFiles.filter((file) => /CoreBridge\.request/.test(read(file)));
assert.deepEqual(bridgeSenders, ['core/client.ts'], 'Core requests have one platform boundary');

// Stable state ownership: pages request changes through store commands.
const featureSource = features.map(read).join('\n');
assert.doesNotMatch(featureSource, /store\.[\w.]+\.set\(/, 'features must not write store signals directly');

// Stable visual policy: application code uses named roles and audited tokens.
for (const file of [...atoms, ...features, 'App.tsx']) {
  const source = read(file);
  assert.doesNotMatch(source, /#[0-9A-Fa-f]{6}\b/, `${file}: colors belong to the runtime theme`);
  assert.doesNotMatch(
    source,
    /["'`\s](?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)-\d/,
    `${file}: spacing must use named inset/size tokens`,
  );
  assert.doesNotMatch(source, /["'`\s]text-(?:xs|sm|base|lg|xl|\d)/, `${file}: typography must use named font roles`);
  assert.doesNotMatch(source, /\bdark:/, `${file}: runtime theme tokens own appearance`);
}

// Stable configuration contracts are data, not implementation shape.
const config = JSON.parse(read('nsh.json'));
assert.equal(config.tailwind.fontSize.base[0], 14, 'iOS body text uses the app type scale');
assert.deepEqual(
  Object.keys(config.theme.cssVars.light).sort(),
  Object.keys(config.theme.cssVars.dark).sort(),
  'light and dark themes expose the same semantic roles',
);

console.log('Vela iOS static boundaries passed');
