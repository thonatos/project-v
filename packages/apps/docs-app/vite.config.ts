import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  plugins: [
    !isDev &&
      cloudflare({
        viteEnvironment: {
          name: 'docs-app',
        },
      }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
});
