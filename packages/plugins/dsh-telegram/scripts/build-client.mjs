import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputPath = resolve(packageRoot, 'lib/client.js');
const result = await build({
  entryPoints: [resolve(packageRoot, 'src/client.js')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome100'],
  external: ['react', 'react-dom'],
  write: false,
  legalComments: 'none',
});
const bundled = result.outputFiles?.[0]?.text;
if (!bundled) throw new Error('esbuild did not produce a Telegram client bundle');
const wrapped = `window.__ModuleLoader__.load({\n  id: "@project-v/dsh-telegram",\n  factory: (require) => {\n    var module = { exports: {} };\n    var _exports = module.exports;\n${bundled}\n    return module.exports;\n  },\n});\n`;
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, wrapped, 'utf8');
console.log(`Wrote ${outputPath}`);
