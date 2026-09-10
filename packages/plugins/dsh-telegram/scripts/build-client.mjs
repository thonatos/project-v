import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputPath = resolve(packageRoot, 'lib/client.js');
const packageMetadata = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
const result = await build({
  entryPoints: [resolve(packageRoot, 'src/client.js')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome100'],
  external: ['react', 'react-dom'],
  define: {
    'globalThis.__DSH_TELEGRAM_VERSION__': JSON.stringify(packageMetadata.version),
  },
  write: false,
  legalComments: 'none',
});
const bundled = result.outputFiles?.[0]?.text;
if (!bundled) throw new Error('esbuild did not produce a Telegram client bundle');
const wrapped = `window.__ModuleLoader__.load({\n  id: "@implementsio/dsh-telegram",\n  factory: (require) => {\n    var module = { exports: {} };\n    var _exports = module.exports;\n${bundled}\n    return module.exports;\n  },\n});\n`;
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, wrapped, 'utf8');
console.log(`Wrote ${outputPath}`);
