---
applyTo: "**/*.ts,**/*.tsx"
---
# Monorepo Copilot Instructions

Apply the [general coding guidelines](.github/instructions/general-coding.instructions.md) to all code in this repository.

## Global Coding Standards
- Follow naming conventions and code quality rules in the general coding guidelines.


## Monorepo Structure
This repository is managed with Rush and contains multiple applications under `packages/apps/`. Each app has its own tech stack and conventions. Follow the relevant section below for the app you are working on.

---

## 1. React SPA (`react-app`)
**Stack:** React, TypeScript, Tailwind CSS, shadcn/ui, Jotai, Sonner, React Router

- Use TypeScript for all code
- Use functional programming principles where possible
- Use interfaces for data structures and type definitions
- Prefer immutable data (`const`, `readonly`)
- Use optional chaining (?.) and nullish coalescing (??)
- Use proper generic types with React components
- Export types alongside components for reusability

### React Guidelines
- Use functional components with hooks
- Follow the React hooks rules (no conditional hooks)
- Prefer function declarations over React.FC: `export function ComponentName(props: Props) {}`
- Keep components small and focused (single responsibility)
- Use Tailwind CSS for styling (not CSS modules)
- **Use shadcn/ui components for the UI library. Do NOT use Radix UI components directly unless you are creating a custom wrapper.**
- Add `data-slot` attributes for component identification in UI components
- Use Jotai for state management
- Use Sonner for toast notifications
- Use React Router for navigation
- Follow the established component structure in `~/components/ui/` for reusable components
- Use the `cn()` utility for conditional class names with Tailwind CSS
- Implement proper loading states with skeleton components

---

## 2. Node.js API (`artusx-api`)
**Stack:** ArtusX framework, TypeScript, Node.js

- Use TypeScript for all code
- Follow ArtusX framework conventions for service, controller, and plugin structure
- Use dependency injection as provided by ArtusX
- Use `this.logger` for logging inside service classes
- Use the `debug` package for structured logging elsewhere
- Handle errors with try/catch and return error objects when appropriate
- Export types and interfaces for all public APIs
- Organize code by feature/module

### Error Handling & Logging
- Use try/catch for async operations
- Always log errors with contextual information
- Use `debug` for structured logging
- Use `this.logger.error()` in ArtusX service classes

---

## 3. Cloudflare Worker API (`remix-api`)
**Stack:** Hono, TypeScript, Supabase, Dayjs

- Use TypeScript for all code
- Use Hono for routing and middleware
- Use async/await for all asynchronous operations
- Handle errors with try/catch and return error responses in API handlers
- Use Dayjs for date/time operations
- Use Supabase client for database access
- Export types for API request/response shapes
- Organize code by route and feature

### Error Handling & Logging
- Use try/catch for async operations
- Log errors with contextual information (e.g., `console.error` or custom logger)

---

## 4. Cloudflare Worker Automation (`remix-flow`)
**Stack:** Cloudflare Workers, Puppeteer, TypeScript

- Use TypeScript for all code
- Use async/await for all asynchronous operations
- Use Puppeteer for browser automation
- Handle errors with try/catch and return error responses
- Organize code by workflow/task
- Export types for workflow/task definitions

### Error Handling & Logging
- Use try/catch for async operations
- Log errors with contextual information (e.g., `console.error` or custom logger)

---

## General
- If you are unsure which conventions to follow, check the app's `package.json` and README.md for stack details.
- Always follow the [general coding guidelines](./general-coding.instructions.md) for naming and code quality.                    
