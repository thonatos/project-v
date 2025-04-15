import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: {
    VITE_BUILD_DATE: process.env.VITE_BUILD_DATE,
  },
  resolve: {
    alias: {
      '~': '/app',
    },
  },
  server: {
    fs: {
      allow: [
        // This is needed to load the shared package
        '../../..',
      ],
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    // sourcemap: true,
    rollupOptions: {
      onLog(level, log, handler) {
        // @ts-ignore
        if (log.cause && log.cause.message === `Can't resolve original location of error.`) {
          return;
        }
        handler(level, log);
      },
    },
  },
  plugins: [
    tailwindcss(),
    reactRouter(),
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
