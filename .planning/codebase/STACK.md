# Technology Stack

**Analysis Date:** 2026-06-23

## Languages

**Primary:**

- TypeScript ^5.5.0 - VS Code Extension source code (in `src` and `test` directories)

**Secondary:**

- JSON - Configuration files (`package.json`, `biome.json`, `tsconfig.json`)

## Runtime

**Environment:**

- VS Code Extension Host (Node.js engine `^1.85.0`)

**Package Manager:**

- pnpm@11.7.0
- Lockfile: present (`pnpm-lock.yaml`)

## Frameworks

**Core:**

- reactive-vscode ^0.3.0 - Reactive VS Code API wrapper for the extension lifecycle

**Testing:**

- Vitest ^2.0.0 - Test runner for unit testing the socket communication

**Build/Dev:**

- tsup ^8.0.0 - Fast TypeScript bundler (bundles `src/extension.ts` -> `dist/extension.js` as CJS)
- Biome ^1.9.0 - Fast formatter, linter, and import organizer
- bumpp ^9.0.0 - CLI tool for version bumping

## Key Dependencies

**Critical:**

- reactive-vscode ^0.3.0 - Essential for managing extension activation, command registration, and reactivity

**Infrastructure:**

- @types/node ^22.0.0 - Node.js type definitions
- @types/vscode ^1.85.0 - VS Code API type definitions

## Configuration

**Environment:**

- VS Code Settings - Configured via `fff-gpui.socketPath` in VS Code configuration

**Build:**

- tsup.config.ts - Configures target (es2022), platform (node), format (cjs), and external dependencies (vscode)
- tsconfig.json - TypeScript compiler configuration for the extension source
- biome.json - Linting and formatting rules (2-space indent, single quotes, no semicolons, noExplicitAny off)
- prek.toml - Pre-commit hooks configuration (biome check, tsc typecheck, vitest run)

## Platform Requirements

**Development:**

- Node.js (matching VS Code target runtime)
- pnpm (package manager)
- macOS or Linux (required for Unix sockets)
- Native daemon `fff-gpui` installed and running (`brew install fff-gpui && brew services start fff-gpui`)

**Production:**

- VS Code `^1.85.0`
- macOS or Linux with `fff-gpui` daemon running

---

_Stack analysis: 2026-06-23_
