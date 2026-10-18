import path from 'node:path';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './app'),
      '~openapi': path.resolve(__dirname, './public/openapi.json'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    globalSetup: ['./tests/global-setup.ts'],
  },
});
