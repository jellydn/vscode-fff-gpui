# 001: Test uncovered modules — config.ts, logger.ts

**Commit**: `96c2c33`
**Executor drift check**: If `git rev-parse --short HEAD` does not match, verify plan steps still apply before starting.

## Context

The extension has 91 tests across 5 files, but two small modules have zero coverage:

- `src/config.ts` (3 sloc) — reads VS Code configuration
- `src/logger.ts` (15 sloc) — wraps `vscode.OutputChannel`

These are the last uncovered source files in the codebase. Both are simple wrappers around the VS Code API that can be tested with the same `vi.mock('vscode')` pattern already established in `test/commands.test.ts`.

### Repo conventions (from existing tests)

The codebase uses these patterns — every plan step must match them exactly:

```typescript
// test/resolveSearchPath.test.ts — pure function test (no mocks)
import { describe, expect, it } from "vitest";
import { resolveSearchTarget } from "../src/commands/resolveSearchPath";

it("returns the first workspace folder path when available", () => {
  const ctx: SearchContext = {
    workspaceFolders: [{ uri: { fsPath: "/home/project" } }],
    activeEditor: undefined,
    homedir: "/home/user",
  };
  expect(resolveSearchTarget(ctx)).toBe("/home/project");
});
```

```typescript
// test/commands.test.ts — vscode mock pattern
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: { getConfiguration: vi.fn() },
  window: { createOutputChannel: vi.fn() },
}));
```

Format: no semicolons, single quotes, trailing commas, 2-space indent, 100 col width.

## Files

| File                  | Status   | Action                              |
| --------------------- | -------- | ----------------------------------- |
| `test/config.test.ts` | New      | Create                              |
| `test/logger.test.ts` | New      | Create                              |
| `src/config.ts`       | Existing | No changes — just test what's there |
| `src/logger.ts`       | Existing | No changes — just test what's there |

## Current state

**`src/config.ts`**:

```typescript
import * as vscode from "vscode";

export function getSocketPath(): string {
  return vscode.workspace.getConfiguration("fff-gpui").get<string>("socketPath", "");
}
```

**`src/logger.ts`**:

```typescript
import * as vscode from "vscode";

let outputChannel: vscode.OutputChannel | undefined;

function channel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("fff-gpui");
  }
  return outputChannel;
}

export function log(message: string): void {
  channel().appendLine(`[${new Date().toISOString()}] ${message}`);
}

export function disposeLogger(): void {
  outputChannel?.dispose();
  outputChannel = undefined;
}
```

## Implementation steps

### Step 1 — Create `test/config.test.ts`

Test the single exported function `getSocketPath()`. Follow the `vi.mock('vscode')` pattern from `test/commands.test.ts`.

Create a mock for `vscode.workspace.getConfiguration`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSocketPath } from "../src/config";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
}));
```

Test cases to cover:

| Test                                                | Mock setup                                                                      | Expectation                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| Returns the configured socket path                  | `getConfiguration` returns object with `get` that returns `'/custom/path.sock'` | `getSocketPath()` returns `'/custom/path.sock'` |
| Returns empty string when setting is not configured | `getConfiguration` returns object with `get` that returns `''` (the default)    | `getSocketPath()` returns `''`                  |
| Uses the correct section name `'fff-gpui'`          | Verify `getConfiguration` was called with `'fff-gpui'`                          |                                                 |

### Step 2 — Create `test/logger.test.ts`

Test the two exported functions `log()` and `disposeLogger()`. Follow the same mock pattern.

The `outputChannel` is module-scoped and lazily initialized. Tests should exercise the lazy creation, the appendLine behavior, and the dispose/cleanup.

Create a mock for `vscode.window.createOutputChannel` returning a mock channel object:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAppendLine = vi.fn();
const mockDispose = vi.fn();
const mockCreateOutputChannel = vi.fn().mockReturnValue({
  appendLine: mockAppendLine,
  dispose: mockDispose,
});

vi.mock("vscode", () => ({
  window: {
    createOutputChannel: mockCreateOutputChannel,
  },
}));
```

Important: Since `outputChannel` is a module-scoped variable, tests that exercise `log` after `disposeLogger` need to be in the right order. Use `beforeEach` to reset the mock states but **do not call `disposeLogger` in beforeEach** — the module state persists between tests in the same file.

Test cases to cover:

| Test                                                            | Sequence                                                             | Expectation                                                                         |
| --------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `log()` creates the output channel on first call                | Call `log('test')`                                                   | `createOutputChannel` called with `'fff-gpui'`                                      |
| `log()` appends an ISO timestamped message                      | Call `log('some message')`                                           | `appendLine` called once with string matching `[/d{4}-/d{2}-/d{2}T.*] some message` |
| `log()` reuses the existing channel                             | Call `log('a')`, then `log('b')`                                     | `createOutputChannel` called only once                                              |
| `disposeLogger()` disposes the channel and clears the reference | Call `log('a')`, then `disposeLogger()`, verify `dispose` was called |                                                                                     |
| `log()` after `disposeLogger()` re-creates the channel          | Call `log('a')`, `disposeLogger()`, then `log('b')`                  | `createOutputChannel` called twice (once per `log` call)                            |

## Verification

1. **Run tests**: `pnpm test` — must show `91 → 97` or more tests passing (6 new config tests + new logger tests).
2. **Lint**: `pnpm lint` — must pass clean (`No fixes applied`).
3. **Typecheck**: `pnpm typecheck` — must pass clean.

## Hard boundaries

- **Do not modify `src/config.ts` or `src/logger.ts`** — this plan is test-only.
- **Do not test `src/extension.ts`** — it uses `reactive-vscode`'s `defineExtension` which requires the full VS Code extension host. That needs a separate plan with a VS Code test runner.
- **Do not add new dependencies** — everything needed (`vitest`, `vi`) is already in the project.

## Test plan

New tests are created (not modifying existing tests). The test plan is the implementation plan — the test file IS the deliverable. After creating the tests, verify with `pnpm test`.

## Maintenance note

- If `config.ts` adds new exported functions, add corresponding tests here.
- If `logger.ts` changes the output format (e.g., dropping timestamps), update the regex in the log message test.
- The module-scoped `outputChannel` state means tests are order-dependent within a single `describe` block. If this becomes brittle, refactor `logger.ts` to accept an optional channel parameter (dependency injection) — but that's out of scope for this plan.

## Escape hatches

- If `vi.mock('vscode')` produces unexpected import hoisting issues: use `vi.hoisted()` like `test/commands.test.ts` does for its mock state.
- If `beforeEach` clearing mock state interferes with module-level state: use `vi.fn().mockImplementation()` directly instead of `beforeEach` for mocks that must persist between tests within a file.
