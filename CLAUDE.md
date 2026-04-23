# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Rush-managed monorepo with multiple applications and libraries. The repo uses pnpm as the package manager and requires Node.js >=20.x.

## Common Commands

### Installation and Build
```bash
# Install dependencies (required on first setup)
rush install
# or
rush update

# Build all projects
rush build

# Build specific project
rush build -t <project-name>

# Deploy (uses rush.json "projects" names)
rush deploy -p remix-api -s remix-api --overwrite
```

### Project-specific Development
Use `rushx` to run scripts in specific projects:
```bash
# React SPA dev server (http://localhost:5173)
rushx -t react-app dev

# ArtusX API dev server
rushx -t artusx-api dev

# Remix API (Cloudflare Workers, remote dev)
rushx -t remix-api dev

# Remix Flow (Cloudflare Workers, local dev)
rushx -t remix-flow dev

# React Component library (Storybook at port 6006)
rushx -t react-component dev
```

### Linting and Type Checking
```bash
# React app
rushx -t react-app typecheck

# ArtusX API
rushx -t artusx-api lint

# React Component library
rushx -t react-component lint
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
- `common/` - Rush configuration, scripts, git hooks

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
- `src/module-*/` - Feature modules (module-api, module-news, module-webhook)
- `src/view/` - View templates
- `migrations/` - Database migrations

**Key conventions:**
- Use dependency injection via ArtusX
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

### Naming Conventions
- **PascalCase** - Component names, interfaces, type aliases
- **camelCase** - Variables, functions, methods
- **_prefix** - Private class members
- **ALL_CAPS** - Constants (e.g., `REMIX_API`, `TZ_ASIA_SHANGHAI`)

### Code Quality
- Follow `.prettierrc.js` formatting
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

### React (react-app)
- Follow React hooks rules (no conditional hooks)
- Keep components small and focused (single responsibility)
- Implement loading states with skeleton components
- Export types for component props

## Rush Project Tags

Projects are tagged for selective operations:
- `apps` - Applications
- `libs` - Libraries
- `plugins` - Plugins
- `tools` - Tools
- `boilerplates` - Boilerplates

Use with Rush commands: `rush build --only tag:apps`
