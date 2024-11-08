import tsconfigPaths from 'vite-tsconfig-paths';

import { defineConfig } from 'vite';
import { remixPWA } from '@remix-pwa/dev';
import { vitePlugin as remix } from '@remix-run/dev';
import { installGlobals } from '@remix-run/node';
import { vercelPreset } from '@vercel/remix/vite';

installGlobals();

export default defineConfig({
  plugins: [
    remixPWA(),
    remix({
      presets: [vercelPreset()],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
});
