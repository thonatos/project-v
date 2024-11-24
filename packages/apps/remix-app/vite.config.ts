import tsconfigPaths from 'vite-tsconfig-paths';

import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { vitePlugin as remix } from '@remix-run/dev';
import { installGlobals } from '@remix-run/node';
import { vercelPreset } from '@vercel/remix/vite';

installGlobals({
  nativeFetch: true,
});

process.env.VITE_BUILD_DATE = new Date().getTime().toString();

export default defineConfig({
  define: {
    VITE_BUILD_DATE: process.env.VITE_BUILD_DATE,
  },
  resolve: {
    alias: {
      '~': '/app',
    },
  },
  plugins: [
    remix({
      presets: [vercelPreset()],
      future: {
        v3_singleFetch: true,
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
    VitePWA({
      srcDir: 'app',
      // outDir: 'public',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      registerType: 'prompt', // prompt || autoUpdate
      manifest: {
        short_name: 'ρV',
        name: 'undefined project - ρV',
        start_url: '/',
        display: 'standalone',
        background_color: '#d3d7dd',
        theme_color: '#c34138',
        edge_side_panel: {
          preferred_width: 480,
        },
      },
      injectManifest: {
        // injectionPoint: undefined,
        swSrc: 'app/sw.ts',
      },

      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
});
