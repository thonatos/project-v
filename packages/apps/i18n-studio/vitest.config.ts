import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './app'),
    },
  },
  test: {
    environment: 'node',
    include: ['app/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
  },
});
