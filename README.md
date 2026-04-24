# project-v

> undefined project - ρV.

## Prerequisites

- Node.js >= 20
- pnpm (`npm install -g pnpm`)

## Development

```bash
# Install dependencies
pnpm install

# Build all projects
pnpm -r build

# Run dev server for specific project
pnpm --filter react-app dev
pnpm --filter artusx-api dev
pnpm --filter remix-api dev
pnpm --filter remix-flow dev
pnpm --filter react-component dev
```

## Code Quality

```bash
# Format code
pnpm biome format --write .

# Lint code
pnpm biome lint .
```

## Deploy

```bash
pnpm install
pnpm -r build
# Deploy via wrangler for Cloudflare Workers projects
pnpm --filter remix-api deploy
pnpm --filter remix-flow deploy
```