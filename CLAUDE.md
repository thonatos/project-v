# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a pnpm-managed monorepo with multiple applications and libraries. The repo requires Node.js >=20.x.

## Common Commands

### Installation and Build
```bash
# Install dependencies (required on first setup)
pnpm install

# Build all projects
pnpm -r build

# Build specific project (use package.json name)
pnpm -F <package-name> build

# Examples:
pnpm -F react-app build
pnpm -F artusx-api build
pnpm -F remix-api build
```

### Project-specific Development
```bash
# React SPA dev server (http://localhost:5173)
pnpm -F react-app dev

# ArtusX API dev server
pnpm -F artusx-api dev

# Remix API (Cloudflare Workers, remote dev)
pnpm -F remix-api dev

# Remix Flow (Cloudflare Workers, local dev)
pnpm -F remix-flow dev

# React Component library (Storybook at port 6006)
pnpm -F react-component dev
```

### Linting and Formatting
```bash
# Run oxlint on all packages
pnpm lint

# Run oxlint with auto-fix
pnpm lint:fix

# Check formatting (dry-run)
pnpm format

# Format all packages
pnpm format:write

# Full project build + lint verification
pnpm -r build && pnpm lint
```

### PWA/React App Customization
```bash
# Generate service worker and manifest (in react-app)
pnpx remix-pwa sw
pnpx remix-pwa manifest

# Add shadcn/ui components (in react-app)
pnpm dlx shadcn@latest add {component}
```

## Project Structure

### Monorepo Layout
- `packages/apps/` - Applications
- `packages/libs/` - Shared libraries

### Applications

#### 1. `react-app` (React SPA)
**Stack:** React Router v7, React 19, TypeScript, Tailwind CSS, shadcn/ui, Jotai, Sonner

**Structure:**
- `app/routes/` - File-based routing with React Router
- `app/components/` - Reusable components
- `app/store/` - Jotai state atoms
- `app/service/` - API services
- `app/lib/` - Utilities and helpers

**Key conventions:**
- Use functional components with hooks (no `React.FC`)
- Use shadcn/ui components (not Radix UI directly)
- Use Tailwind CSS with `cn()` utility for conditional classes
- Use Jotai for state management
- Use Sonner for toast notifications
- Add `data-slot` attributes for component identification

#### 2. `artusx-api` (Node.js API)
**Stack:** ArtusX framework, TypeScript, Node.js

**Structure:**
- `src/config/` - Configuration files
- `src/controller/` - Request handlers
- `src/service/` - Business logic
- `src/types/` - Type definitions (including `config.ts` for AppConfig)
- `src/module-*/` - Feature modules (module-api, module-news, module-webhook)
- `src/view/` - View templates
- `migrations/` - Database migrations

**Key conventions:**
- Use dependency injection via ArtusX
- Use `AppConfig` type from `src/types/config.ts` for config injection
- Use `this.logger` for logging in service classes
- Use `debug` package for structured logging elsewhere
- Handle errors with try/catch

#### 3. `remix-api` (Cloudflare Worker API)
**Stack:** Hono, TypeScript, Supabase, Dayjs

**Structure:**
- `src/routes/` - Hono route definitions
- `src/components/` - Route components
- `src/middlewares/` - Middleware functions
- `src/services/` - API services
- `wrangler.jsonc` - Cloudflare Worker configuration

**Key conventions:**
- Use Hono for routing and middleware
- Use Supabase client for database access
- Use Dayjs for date/time operations
- Deploy via Wrangler: `wrangler deploy --minify`

#### 4. `remix-flow` (Cloudflare Worker Automation)
**Stack:** Cloudflare Workers, Puppeteer, TypeScript

**Key conventions:**
- Use Puppeteer for browser automation
- Use Wrangler for deployment: `wrangler deploy --minify`

#### 5. `react-component` (Shared UI Library)
**Stack:** React, TypeScript, Vite, Storybook

**Key conventions:**
- Use Storybook for component documentation/testing
- Build: `tsc -b && vite build`

## Coding Standards

### Linting (Oxlint)
This project uses **Oxlint** for linting and **Oxfmt** for formatting. Key rules to follow:

- **no-unused-vars**: Avoid unused variables. Use `_` prefix for intentionally unused catch parameters.
- **useButtonType**: Always add `type="button"` to button elements.
- **useNodejsImportProtocol**: Use `node:` protocol for Node.js builtins (e.g., `import path from 'node:path'`).
- **useOptionalChain**: Use optional chaining `?.` instead of `&&` checks.

Configuration files:
- `oxlint.json` - Lint rules and ignore patterns
- `.oxfmtrc.json` - Formatting options (indent width: 2, line width: 120, single quotes)

### Naming Conventions
- **PascalCase** - Component names, interfaces, type aliases
- **camelCase** - Variables, functions, methods
- **_prefix** - Private class members
- **ALL_CAPS** - Constants (e.g., `REMIX_API`, `TZ_ASIA_SHANGHAI`)

### Code Quality
- Follow Oxlint/Oxfmt formatting rules (configured in `oxlint.json` and `.oxfmtrc.json`)
- Use meaningful commit messages (conventional commits)
- Implement proper type definitions for public APIs
- Use constants for magic numbers/strings
- Prefer explicit error handling over silent failures
- Use optional chaining (`?.`) and nullish coalescing (`??`)

### TypeScript
- Use `interface` for data structures and type definitions
- Export types alongside components/functions
- Use proper generic types with React components
- Prefer `const` and `readonly` for immutability
- Avoid `any` - use `unknown` or specific types when type is uncertain

### React (react-app)
- Follow React hooks rules (no conditional hooks)
- Keep components small and focused (single responsibility)
- Implement loading states with skeleton components
- Export types for component props
- Always add `type="button"` to button elements (not just `<button>`)