# CONVENTIONS.md — Coding Conventions

## Formatting (Biome)

- **Semicolons**: None (`semicolons: "asNeeded"`)
- **Quotes**: Single quotes (`quoteStyle: "single"`)
- **Trailing commas**: All (`trailingCommas: "all"`)
- **Indent**: 2 spaces (`indentStyle: "space"`, `indentWidth: 2`)
- **Line width**: 100 characters (`lineWidth: 100`)
- **Imports**: Auto-organized on save (`source.organizeImports: "on"`)

## Linting (Biome)

- Preset: `recommended`
- `noExplicitAny: off` — allowed for catch clauses and mock objects
- `useImportType: error` — must use `import type` for type-only imports
- Unused imports: auto-removed on `lint:fix --unsafe`

## Import Style

- Node.js built-ins: `import * as fs from 'node:fs'` (with `node:` prefix)
- VS Code API: `import * as vscode from 'vscode'`
- Type imports: `import type { PickEntry } from '../types'` (required by `useImportType` rule)
- Third-party: `import { defineExtension, useCommand } from 'reactive-vscode'`
- Test imports: Vitest's `describe`, `it`, `expect`, `vi`, `beforeEach` from `'vitest'`
- Local imports: relative paths from current file

## Error Handling

### Socket errors (`src/client.ts`)

- `ENOENT` → `"socket file does not exist"`
- `ECONNREFUSED` → `"daemon is not listening"`
- Both wrap into: `"fff-gpui daemon is not running (<detail>). Install with: brew install fff-gpui && brew services start fff-gpui"`
- Timeout: `"Connection timed out while waiting for file selection"`

### Parse errors (`src/client.ts`)

- Full payload logged to output channel via `log()`
- User-facing message truncated to first 100 chars + `…`

### Validation errors (`src/client.ts`)

- Malformed response shape: `"fff-gpui daemon returned an invalid response (expected { paths: PickEntry[] })"`
- Individual entry validation: checked inside `isPickEntry()` type guard

### Command errors (`src/commands/runPicker.ts`)

- Any error from `sendCommand()` is caught and displayed via `vscode.window.showErrorMessage('fff-gpui: <message>')`
- Status bar message shown before sending (8s timeout), still visible during error

### File loading errors (`src/commands/openFiles.ts`)

- Load stage: `Promise.allSettled` — failures do not reject the batch
- Show stage: `Promise.allSettled` — one failed show doesn't block others
- Partial failure: `vscode.window.showWarningMessage('fff-gpui: failed to open N file(s)')`
- Show failures: logged to `console.warn`

## Pattern: Shared Runner

Both `findFiles` and `grepFiles` delegate to `runPicker()`. The only difference is the `inGrep` flag and `statusTip` string. This avoids code duplication.

```typescript
// findFiles.ts
export async function findFiles(): Promise<void> {
  await runPicker({
    inGrep: false,
    statusTip: "Tip: type globs like **/*.ts or git:modified in the search bar to filter",
  });
}

// grepFiles.ts
export async function grepFiles(): Promise<void> {
  await runPicker({
    inGrep: true,
    statusTip:
      "Tip: type a search pattern (e.g. TODO) — plain text, regex, or fuzzy modes available",
  });
}
```

## Pattern: Fault-Tolerant Loading

All document operations use `Promise.allSettled` instead of `Promise.all`:

```typescript
// Load stage
const loadResults = await Promise.allSettled(
  entries.map((entry) => vscode.workspace.openTextDocument(vscode.Uri.file(entry.path))),
);
// Pair successful loads with entries, skip failures
const pairs: { entry: PickEntry; doc: vscode.TextDocument }[] = [];
for (let i = 0; i < loadResults.length; i++) {
  if (loadResults[i]?.status === "fulfilled") {
    pairs.push({ entry: entries[i]!, doc: loadResults[i].value });
  }
}
```

## Pattern: Test Mocking (Hoisted State)

Tests use `vi.hoisted()` for mutable mock state that needs to be accessible from both the mock factory and test body:

```typescript
const { sendCommandMock, mockState } = vi.hoisted(() => ({
  sendCommandMock: vi.fn(),
  mockState: { workspaceFolders: undefined, ... },
}))

vi.mock('../src/client', () => ({
  sendCommand: sendCommandMock,  // references hoisted variable
}))
```

## Pattern: Message Prefix

All user-facing messages are prefixed with `fff-gpui:`:

- Error messages: `"fff-gpui: <error description>"`
- Warning messages: `"fff-gpui: failed to open N file(s)"`
- Status bar: `"Tip: ..."` (no prefix, informational)

## Pattern: Type Guards

Runtime validation uses TypeScript type predicates:

```typescript
function isPickEntry(entry: unknown): entry is PickEntry { ... }
function isPickResponse(value: unknown): value is PickResponse { ... }
```

## Pattern: Config Access

Configuration is read imperatively at command invocation time, not reactively:

```typescript
export function getSocketPath(): string {
  return vscode.workspace.getConfiguration("fff-gpui").get<string>("socketPath", "");
}
```

## Comment Style

- `// ---- Section separators ----` in test files for visual grouping
- Minimal comments in production code — code should be self-documenting
- Biome ignore comments used for intentional `noTemplateCurlyInString` violations:
  ```typescript
  // biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${workspaceFolder} string
  if (resolved.includes('${workspaceFolder}')) { ... }
  ```
