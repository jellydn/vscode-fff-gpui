# Coding Conventions

**Analysis Date:** 2026-06-23

## Naming Patterns

**Files:**
- Extension entrypoint is `src/extension.ts`.
- Command implementations are camelCase (e.g., `findFiles.ts`, `grepFiles.ts`, `openFiles.ts`) located in `src/commands/`.
- Utility, config, and definition files are camelCase (e.g., `client.ts`, `config.ts`, `logger.ts`, `types.ts`).

**Functions:**
- CamelCase naming format (e.g., `sendCommand`, `getSocketPath`, `openFiles`, `log`, `disposeLogger`).
- Standard extension lifecycle hooks are named `activate` and `deactivate`.

**Variables:**
- CamelCase naming format (e.g., `socketPath`, `data`, `trimmed`, `workspaceRoot`, `response`, `uri`, `doc`, `options`, `line`, `col`).

**Types:**
- PascalCase for interfaces and types (e.g., `ServiceCommand`, `PickEntry`, `PickResponse`).

## Code Style

**Formatting:**
- Biome formatter (configured in `biome.json`).
- Space indentation style with `indentWidth` of 2.
- Maximum line width of 100 characters.
- JavaScript/TypeScript formatting details:
  - Semicolons: `asNeeded` (omitted unless syntactically necessary).
  - Quotes: Single quotes (`'`).
  - Trailing commas: `all`.

**Linting:**
- Biome linter (configured in `biome.json`).
- Key rules:
  - Recommended linter rules enabled.
  - `suspicious.noExplicitAny` set to `"off"`.
  - `style.useImportType` set to `"error"`.

## Import Organization

**Order:**
1. Node.js built-ins with the `node:` protocol prefix (e.g., `import * as net from 'node:net'`).
2. Third-party library/framework modules (e.g., `import * as vscode from 'vscode'`, `import { defineExtension } from 'reactive-vscode'`).
3. Local/internal modules using relative paths (e.g., `import { sendCommand } from '../client'`).
4. TypeScript type-only imports (e.g., `import type { PickResponse } from './types'`).

**Path Aliases:**
- None configured (strictly relative paths like `./` or `../`).

## Error Handling

**Patterns:**
- Promises return reject/resolve handlers (e.g., socket communication wrapping in `sendCommand`).
- Errors propagated up from connections/socket events are caught in commands and displayed to the user via VS Code's `vscode.window.showErrorMessage`.
- Distinguishes specific network error codes (`ENOENT`, `ECONNREFUSED`) to prompt installation instructions for the daemon.

## Logging

**Framework:** Custom console-to-OutputChannel wrapper in `src/logger.ts`.

**Patterns:**
- Logger creates or uses a shared `vscode.OutputChannel` named `'fff-gpui'`.
- `log(message)` outputs prepended with an ISO timestamp: `[${new Date().toISOString()}] ${message}`.
- Logger is disposed on extension deactivation via `disposeLogger()`.

## Comments

**When to Comment:**
- Minimal commenting. The code is written to be clean and self-documenting.

**JSDoc/TSDoc:**
- Not used.

## Function Design

**Size:** Small, focused, single-purpose functions, usually under 30 lines.

**Parameters:** Passed as structured types/interfaces (e.g., `ServiceCommand`, `PickEntry[]`) or individual variables.

**Return Values:** Typically asynchronous functions returning `Promise<void>` or `Promise<T>`.

## Module Design

**Exports:**
- Named exports are preferred (e.g., `export async function findFiles()`, `export function sendCommand()`).
- Entrypoint `src/extension.ts` exports `activate` and `deactivate` destructuring from `defineExtension(...)`.

**Barrel Files:**
- None used in this project.

---

*Convention analysis: 2026-06-23*
