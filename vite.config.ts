import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    useTabs: false,
    tabWidth: 2,
    printWidth: 120,
    singleQuote: true,
    jsxSingleQuote: false,
    quoteProps: 'as-needed',
    trailingComma: 'all',
    semi: true,
    arrowParens: 'always',
    bracketSameLine: false,
    bracketSpacing: true,
    ignorePatterns: [
      'packages/apps/docs-app/.react-router/**',
      'packages/apps/docs-app/build/**',
      'packages/apps/i18n-studio/app/i18n/generated.ts',
      'packages/plugins/dsh-telegram/lib/**',
    ],
  },
  lint: {
    ignorePatterns: [
      'packages/apps/react-app/app/components/ui/**',
      'packages/apps/docs-app/.react-router/**',
      'packages/apps/docs-app/build/**',
    ],
    categories: {
      correctness: 'warn',
      suspicious: 'off',
      perf: 'off',
      style: 'off',
      pedantic: 'off',
      restriction: 'off',
      nursery: 'off',
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react/exhaustive-deps': 'off',
      'react/immutability': 'off',
      'react/purity': 'off',
      'react/refs': 'off',
      'react/set-state-in-effect': 'off',
      'react/static-components': 'off',
      'react/use-memo': 'off',
    },
    plugins: ['typescript', 'react', 'import', 'unicorn'],
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  staged: {
    '*.{js,jsx,ts,tsx,mjs,cjs}': ['vp fmt --write', 'vp lint --fix'],
    '*.{json,jsonc,css,md,yaml,yml}': 'vp fmt --write',
  },
  test: {
    projects: [
      './packages/apps/i18n-studio/vitest.config.ts',
      './packages/tools/gpm/vitest.config.ts',
      './packages/plugins/dsh-telegram/vitest.config.ts',
    ],
  },
});
