import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const patchPath = resolve(packageRoot, 'cordis.patch.yml');
const yaml = '- insert:\n    - id: dsh-telegram\n      name: "@implementsio/dsh-telegram"\n';
await writeFile(patchPath, yaml, 'utf8');
console.log(`Wrote ${patchPath}`);
