## 1. 更新 biome.json 配置

- [x] 1.1 启用 linter：设置 `linter.enabled: true`
- [x] 1.2 配置 linter rules：设置 `linter.rules.recommended: true`
- [x] 1.3 添加 files include：配置 `["packages/**/*.ts", "packages/**/*.tsx", "packages/**/*.js"]`

## 2. 更新 package.json scripts

- [x] 2.1 添加 `lint` script：`biome lint packages`
- [x] 2.2 添加 `lint:fix` script：`biome lint packages --write`

## 3. 更新 pre-commit hook

- [x] 3.1 修改 `.husky/pre-commit`：添加 `pnpm lint` 步骤在 `pnpm format` 之前

## 4. 验证配置

- [x] 4.1 运行 `pnpm lint` 验证 lint 功能正常工作（发现现有代码 lint 问题，后续单独处理）