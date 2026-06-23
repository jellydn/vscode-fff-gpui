# 002: Resolve logging inconsistencies — replace console.warn with logger

**Commit**: `96c2c33`
**Executor drift check**: If `git rev-parse --short HEAD` does not match, verify plan steps still apply before starting.

## Context

`src/commands/openFiles.ts` uses `console.warn()` to log document-show failures, while every other module in the codebase uses `src/logger.ts` (`log()`) which writes to the VS Code OutputChannel panel (`Cmd+Shift+U` → select `fff-gpui`).

This means failed document-show operations are invisible to users who check the OutputChannel for diagnostics — they only appear in the developer console (`Cmd+Option+I`).

### Repo conventions

The entire codebase uses the `logger.ts` module for diagnostic output:

```typescript
// src/client.ts
import { log } from "./logger";
log(`Failed to parse response from fff-gpui daemon: ${raw}`);
```

Format: no semicolons, single quotes, trailing commas, 2-space indent, 100 col width. Biome lints with `useImportType: error`.

## Files

| File                        | Status   | Action                                    |
| --------------------------- | -------- | ----------------------------------------- |
| `src/commands/openFiles.ts` | Existing | Replace `console.warn` with `log()`       |
| `src/logger.ts`             | Existing | No changes needed — already exports `log` |

## Current state

**`src/commands/openFiles.ts`** (last 4 lines):

```typescript
for (const result of showResults) {
  if (result.status === "rejected") {
    console.warn("fff-gpui: failed to show document:", result.reason);
  }
}
```

## Target state

```typescript
import { log } from "../logger";

// ... inside the function:
for (const result of showResults) {
  if (result.status === "rejected") {
    log(`failed to show document: ${result.reason}`);
  }
}
```

Note the differences:

- `console.warn` → `log()`
- Multiple arguments (`'prefix:', reason`) → template literal (`prefix: ${reason}`)
- Prefix `'fff-gpui: '` → already included by convention (the OutputChannel is named `fff-gpui`), but kept in the message for consistency with `client.ts` which also uses descriptive messages

## Implementation steps

### Step 1 — Add the import

Add `import { log } from '../logger'` to the imports at the top of `src/commands/openFiles.ts`.

The existing imports are:

```typescript
import * as vscode from "vscode";
import type { PickEntry } from "../types";
```

Add after the `PickEntry` import:

```typescript
import { log } from "../logger";
```

### Step 2 — Replace `console.warn`

Replace:

```typescript
console.warn("fff-gpui: failed to show document:", result.reason);
```

With:

```typescript
log(`failed to show document: ${result.reason}`);
```

### Step 3 — Clean up

Run `pnpm lint:fix` to organize imports and verify formatting.

## Verification

1. **Lint**: `pnpm lint` — must pass clean.
2. **Typecheck**: `pnpm typecheck` — must pass clean.
3. **Tests**: `pnpm test` — all 91 tests must still pass. No test changes needed since the existing mock for `logger.ts` (`test/commands.test.ts` uses `vi.mock('../src/logger', () => ({ log: vi.fn() }))`) already captures `log` calls.
4. **Verify the mock captures the call**: Check that `test/commands.test.ts` mocks `../src/logger` — it does (the mock exists). The test for "does not reject when a showTextDocument call fails" will continue to pass because `log` is already mocked.

## Hard boundaries

- **Do not change any other logging calls** — `client.ts` already uses `log()` correctly. This plan is scoped to the one `console.warn` instance.
- **Do not change the test file** — the existing mock in `test/commands.test.ts` (`vi.mock('../src/logger', () => ({ log: vi.fn() }))`) already covers the new `log` call. No test changes needed.
- **Do not add a new `log()` test in this file** — the existing test "does not reject when a showTextDocument call fails" already verifies the behavior; it just logs differently now.

## Maintenance note

- If the loop body grows more logging, keep using `log()` — never introduce `console.*` for diagnostic output.
- The `log()` function writes to the VS Code OutputChannel named `fff-gpui`. All user-facing diagnostic output should go there.

## Escape hatches

- If `pnpm lint:fix` introduces unexpected import ordering, verify the order matches the existing convention (external modules first, then internal modules).
