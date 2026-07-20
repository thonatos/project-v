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
  // 确保 R3F 生态与应用共用同一份 React，避免 "more than one copy of React"
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
  },
});
