# Coding Conventions

**Analysis Date:** 2026-06-23

## Naming Patterns

**Files:**

- Source files use descriptive camelCase module names such as `src/client.ts`, `src/config.ts`, `src/logger.ts`, `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`, `src/commands/openFiles.ts`, `src/commands/resumeSearch.ts`, and `src/commands/runCustomTask.ts`.
- Tests live under `test/` and use the `.test.ts` suffix, currently `test/client.test.ts`.
- Build and tool configuration files are root-level TypeScript/JSON files such as `vitest.config.ts`, `tsup.config.ts`, `biome.json`, and `package.json`.

**Functions:**

- Exported command handlers are async camelCase functions returning `Promise<void>`, e.g. `findFiles()` in `src/commands/findFiles.ts`, `grepFiles()` in `src/commands/grepFiles.ts`, `openFiles(entries)` in `src/commands/openFiles.ts`, and `runCustomTask()` in `src/commands/runCustomTask.ts`.
- Pure helpers use camelCase verbs/nouns and explicit return types, e.g. `resolveSocketPath(socketPath, workspaceRoot)` and `verifySocketSecurity(socketPath)` in `src/client.ts`, `getSocketPath()` in `src/config.ts`, and `getLastSearch()` in `src/commands/resumeSearch.ts`.
- Internal helpers are unexported unless needed outside the module, e.g. `defaultSocketPath()` in `src/client.ts`, `channel()` in `src/logger.ts`, and `getCustomTasks()` in `src/commands/runCustomTask.ts`.

**Variables:**

- Locals use camelCase and descriptive names: `socketPath`, `workspaceRoot`, `searchPath`, `activeEditor`, `response`, `outputChannel`, `lastSearch`, `selected`, and `terminal` in `src/client.ts`, `src/commands/findFiles.ts`, `src/logger.ts`, `src/commands/resumeSearch.ts`, and `src/commands/runCustomTask.ts`.
- Tests use explicit handler variable names to capture mocked event callbacks, e.g. `connectHandler`, `dataHandler`, `endHandler`, `errorHandler`, and `timeoutHandler` in `test/client.test.ts`.
- Constants in tests can be PascalCase when representing a mock object, e.g. `MockSocket` in `test/client.test.ts`.

**Types:**

- Shared exported interfaces use PascalCase and live in `src/types.ts`: `ServiceCommand`, `PickEntry`, and `PickResponse`.
- Module-local types also use PascalCase, e.g. `SearchKind` and `CachedSearch` in `src/commands/resumeSearch.ts`, and `CustomTask` in `src/commands/runCustomTask.ts`.
- Type-only imports use `import type`, e.g. `import type { PickResponse, ServiceCommand } from './types'` in `src/client.ts` and `import type { PickEntry } from '../types'` in `src/commands/openFiles.ts`.

## Code Style

**Formatting:**

- Tool used: Biome via `npm run lint` (`biome check`) and `npm run lint:fix` (`biome check --write`) from `package.json`.
- Key settings are defined in `biome.json`: 2-space indentation, 100-character line width, single quotes, trailing commas, and semicolons as needed/no semicolons in normal code.
- Formatting pattern examples include multi-line calls with trailing commas in `src/client.ts` (`throw new Error(...,)`) and `src/commands/findFiles.ts` (`vscode.window.setStatusBarMessage(..., 8000,)`).

**Linting:**

- Tool used: Biome recommended rules in `biome.json`, checked over `src/**/*.ts`, `test/**/*.ts`, `tsup.config.ts`, and `vitest.config.ts`.
- Key rules: `useImportType` is an error, `noExplicitAny` is disabled, and imports are organized by Biome (`organizeImports.enabled: true`) in `biome.json`.
- Explicit `any` is used intentionally for test mocks and Node error handling, e.g. `catch (err: any)` in `src/client.ts` and `(net.createConnection as any)` / `(call: any[])` in `test/client.test.ts`.

## Import Organization

**Order:**

1. Node built-ins first, using `node:` specifiers: `node:fs`, `node:net`, `node:os`, and `node:path` in `src/client.ts`; `node:os` and `node:path` in `src/commands/findFiles.ts` and `src/commands/grepFiles.ts`.
2. External packages next: `vscode`, `reactive-vscode`, and `vitest` imports in `src/config.ts`, `src/extension.ts`, and `test/client.test.ts`.
3. Local relative imports last, with type imports marked type-only: `../client`, `../config`, `./openFiles`, `../types`, and `./types` in files under `src/`.

**Path Aliases:**

- No TypeScript path aliases are used; imports are relative (`./commands/findFiles`, `../src/client`, `../types`) in `src/extension.ts`, `test/client.test.ts`, and `src/commands/openFiles.ts`.

## Error Handling

**Patterns:**

- Socket client errors are converted to user-actionable messages in `src/client.ts`: `ENOENT` and `ECONNREFUSED` become an install/start instruction for `fff-gpui`; invalid JSON becomes `Failed to parse response from fff-gpui daemon`; timeout destroys the socket and rejects with `Connection timed out while waiting for file selection`.
- Security validation throws synchronously in `verifySocketSecurity()` in `src/client.ts`, while `sendCommand()` catches and returns `Promise.reject(err)` so callers can use async rejection handling.
- VS Code command handlers catch errors at the command boundary and show UI messages with `vscode.window.showErrorMessage`, e.g. `src/commands/findFiles.ts` and `src/commands/grepFiles.ts`.
- Non-critical document display failures are isolated with `Promise.allSettled()` and logged without stopping other opens in `src/commands/openFiles.ts`.
- User cancellation/empty state is handled with early returns: no entries in `src/commands/openFiles.ts`, no prior search in `src/commands/resumeSearch.ts`, no configured task or no selected task in `src/commands/runCustomTask.ts`.

## Logging

**Framework:** VS Code OutputChannel plus occasional console warning

**Patterns:**

- Extension lifecycle and command invocation logs go through `log(message)` in `src/logger.ts`, which appends timestamped lines to a lazily created `vscode.window.createOutputChannel('fff-gpui')` channel.
- `src/extension.ts` logs activation, deactivation, and each command invocation (`findFiles`, `grepFiles`, `pickFileFromGitStatus`, `findTodoFixme`, `resumeSearch`, `runCustomTask`).
- Search cache changes are logged in `saveSearch(kind)` in `src/commands/resumeSearch.ts`.
- Recoverable document display failures use `console.warn('fff-gpui: failed to show document:', result.reason)` in `src/commands/openFiles.ts`.

## Comments

**When to Comment:**

- Comments are sparse and used to explain non-obvious behavior, not routine statements.
- Examples include parallel document loading and failure isolation in `src/commands/openFiles.ts`, dynamic imports to avoid circular dependencies in `src/commands/resumeSearch.ts`, and a test expectation note about fallback path resolution in `test/client.test.ts`.

**JSDoc/TSDoc:**

- No JSDoc/TSDoc is currently used in `src/client.ts`, `src/extension.ts`, `src/commands/*.ts`, or `test/client.test.ts`; explicit TypeScript types provide the API documentation.

## Function Design

**Size:** Functions are small and focused by responsibility. Examples: `getSocketPath()` in `src/config.ts` only reads configuration; `log()` and `disposeLogger()` in `src/logger.ts` only manage logging; command modules such as `src/commands/findFiles.ts` and `src/commands/grepFiles.ts` orchestrate workspace path selection, daemon call, and opening results.

**Parameters:** Parameters are explicit and usually primitive/domain types, e.g. `sendCommand(command, socketPathOverride?, workspaceRoot?)` in `src/client.ts`, `resolveSocketPath(socketPath, workspaceRoot?)` in `src/client.ts`, and `openFiles(entries: PickEntry[])` in `src/commands/openFiles.ts`.

**Return Values:** Return types are explicit. Command functions return `Promise<void>` in `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`, `src/commands/openFiles.ts`, `src/commands/resumeSearch.ts`, and `src/commands/runCustomTask.ts`; helpers return concrete types such as `string`, `void`, `CachedSearch | null`, and `Promise<PickResponse>` in `src/config.ts`, `src/client.ts`, and `src/commands/resumeSearch.ts`.

## Module Design

**Exports:** Each module exports the functions/types used externally and keeps implementation details private. `src/client.ts` exports `resolveSocketPath`, `verifySocketSecurity`, and `sendCommand` while keeping `defaultSocketPath` private; `src/logger.ts` exports `log` and `disposeLogger` while keeping `channel` private; `src/types.ts` exports only shared interfaces.

**Barrel Files:** No barrel files are used. Consumers import concrete modules directly, e.g. `src/extension.ts` imports from `./commands/findFiles`, `./commands/grepFiles`, `./commands/resumeSearch`, `./commands/runCustomTask`, and `./logger`.

---

_Convention analysis: 2026-06-23_
