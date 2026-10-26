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

const atoms = sources('ui/');
const features = sources('features/');
const core = sources('core/');
const appFiles = [...atoms, ...features, ...core, 'App.tsx'];

// Stable dependency boundaries: presentation atoms know no product/Core;
// features know no native bridge; the data layer renders no JSX.
for (const file of atoms) {
  assert.doesNotMatch(
    read(file),
    /from ['"]\.\.\/core|from ['"]\.\.\/features|shared\/ui\//,
    `${file}: UI atoms must not depend on Core, features or product projections`,
  );
}
for (const file of [...features, 'App.tsx']) {
  const source = read(file);
  assert.doesNotMatch(source, /vela\/native|CoreBridge/, `${file}: only core/client.ts may access the native bridge`);
  assert.doesNotMatch(source, /JSON\.parse/, `${file}: only the client/data boundary parses Core responses`);
}
for (const file of core) {
  assert.ok(file.endsWith('.ts'), `${file}: the data layer must not render JSX`);
  assert.doesNotMatch(read(file), /from ['"]\.\.\/features/, `${file}: the data layer must not depend on features`);
}

const bridgeSenders = appFiles.filter((file) => /CoreBridge\.request/.test(read(file)));
assert.deepEqual(bridgeSenders, ['core/client.ts'], 'Core requests have one platform boundary');

// Stable state ownership: pages request changes through store commands.
const featureSource = features.map(read).join('\n');
assert.doesNotMatch(featureSource, /store\.[\w.]+\.set\(/, 'features must not write store signals directly');

// Stable visual policy: feature code composes named tokens instead of raw
// palette values or one-off spacing/row geometry.
for (const file of features) {
  const source = read(file);
  assert.doesNotMatch(source, /#[0-9A-Fa-f]{6}\b/, `${file}: colors belong to the runtime theme`);
  assert.doesNotMatch(source, /\bdark:/, `${file}: runtime theme tokens own appearance`);
  assert.doesNotMatch(
    source,
    /["`\s](?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|gap|gap-x|gap-y)-\d/,
    `${file}: feature spacing must use named application tokens`,
  );
  assert.doesNotMatch(source, /min-h-\[/, `${file}: feature code must not invent row geometry`);
}

console.log('Vela macOS static boundaries passed');
