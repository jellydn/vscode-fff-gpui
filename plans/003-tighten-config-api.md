# 003: Tighten config API — getSocketPath returns undefined instead of empty string

**Commit**: `96c2c33`
**Executor drift check**: If `git rev-parse --short HEAD` does not match, verify plan steps still apply before starting.

## Context

`src/config.ts` defines:

```typescript
export function getSocketPath(): string {
  return vscode.workspace.getConfiguration("fff-gpui").get<string>("socketPath", "");
}
```

The return type is `string`, and the default value is `''` (empty string). However, every caller immediately converts the empty string to `undefined`:

```typescript
// src/commands/runPicker.ts
getSocketPath() || undefined;
```

This is a code smell — the function's API says "you get a string" but the contract is really "you get a string path or nothing." The `|| undefined` coersion at every call site is boilerplate that obscures intent. If in the future the empty string becomes a valid path (it shouldn't, but APIs evolve), the coersion would silently accept it.

The fix: change the function to return `string | undefined`, use `undefined` as the default, and remove the `|| undefined` coersion at call sites.

**Relevant ADR**: ADR 002 (config API decision) — the original decision used `get<string>('socketPath', '')`. The ADR didn't explicitly consider `undefined` as the default. This change is consistent with ADR 002's reasoning.

### Repo conventions

- `noUncheckedIndexedAccess: true` in tsconfig — the codebase already handles `undefined` values.
- All function return types are explicitly annotated in the codebase.
- Format: no semicolons, single quotes, trailing commas, 2-space indent, 100 col width.

## Files

| File                        | Status                   | Action                                      |
| --------------------------- | ------------------------ | ------------------------------------------- | --- | ------------------- |
| `src/config.ts`             | Existing                 | Change return type + default value          |
| `src/commands/runPicker.ts` | Existing                 | Remove `                                    |     | undefined` coersion |
| `test/commands.test.ts`     | Existing                 | Verify tests still pass (no change needed)  |
| `test/config.test.ts`       | Existing (from Plan 001) | Update tests if Plan 001 was executed first |

## Current state

**`src/config.ts`**:

```typescript
import * as vscode from "vscode";

export function getSocketPath(): string {
  return vscode.workspace.getConfiguration("fff-gpui").get<string>("socketPath", "");
}
```

**`src/commands/runPicker.ts`** (relevant line):

```typescript
getSocketPath() || undefined,
```

The full context in `runPicker`:

```typescript
const response = await sendCommand(
  {
    cmd: "open_path",
    path: searchPath,
    in_grep: options.inGrep,
  },
  getSocketPath() || undefined,
  searchPath,
);
```

`sendCommand`'s second parameter is `socketPathOverride?: string` — it accepts `string | undefined`. The `|| undefined` exists solely to convert `''` to `undefined`.

## Target state

**`src/config.ts`**:

```typescript
import * as vscode from "vscode";

export function getSocketPath(): string | undefined {
  const value = vscode.workspace.getConfiguration("fff-gpui").get<string>("socketPath");
  return value || undefined;
}
```

Or more simply (since `get()` without a default returns `string | undefined` when the property is optional):

```typescript
export function getSocketPath(): string | undefined {
  return vscode.workspace.getConfiguration("fff-gpui").get<string>("socketPath") || undefined;
}
```

**`src/commands/runPicker.ts`** (replace line):

```typescript
getSocketPath(),
```

## Implementation steps

### Step 1 — Update `src/config.ts`

Change the function to return `string | undefined`. Remove the default `''` argument to `get()`. The `get()` method already returns `string | undefined` when the property is optional (it is — the schema defines `"default": ""` but that's the VS Code default, not the TypeScript default).

```typescript
export function getSocketPath(): string | undefined {
  return vscode.workspace.getConfiguration("fff-gpui").get<string>("socketPath") || undefined;
}
```

The `|| undefined` is still needed because `get()` could return `''` (VS Code's own default) when the user hasn't changed the setting. Since `''` is falsy, `'' || undefined` → `undefined`.

### Step 2 — Update `src/commands/runPicker.ts`

Replace `getSocketPath() || undefined` with just `getSocketPath()`.

```diff
- getSocketPath() || undefined,
+ getSocketPath(),
```

### Step 3 — Update tests if Plan 001 was executed first

If `test/config.test.ts` was created by Plan 001:

- Update the "Returns empty string when setting is not configured" test: `getSocketPath()` should now return `undefined`, not `''`.
- The mock setup: the mock `get` function should return `''` (VS Code default), and the test should expect `undefined` from `getSocketPath()`.

If Plan 001 has NOT been executed yet, no test changes are needed — `test/commands.test.ts` already uses `getSocketPathMock.mockReturnValue('')` and `test/commands.test.ts` passes `getSocketPath() || undefined` which works with both old and new implementations.

## Verification

1. **Typecheck**: `pnpm typecheck` — must pass clean. The return type change is the primary risk.
2. **Lint**: `pnpm lint` — must pass clean.
3. **Tests**: `pnpm test` — all 91 tests must still pass.
4. **Manual check**: Verify that `test/commands.test.ts` has `getSocketPathMock.mockReturnValue('')` — this test validates that when config returns `''`, `sendCommand` receives `undefined` as the second argument. With the new code, `getSocketPath()` returns `undefined` instead of `''`, so `getSocketPathMock.mockReturnValue('')` still works (the mock bypasses `config.ts` entirely — it mocks the module). No test changes needed.

## Hard boundaries

- **Do not change `sendCommand`'s type signature** — it already accepts `string | undefined`.
- **Do not change other callers of `getSocketPath()`** — verify there are no other callers first. Current callers: only `src/commands/runPicker.ts`.
- **Do not change the VS Code setting schema** — the `"default": ""` in package.json is correct behavior.

## Maintenance note

- If a new module needs the socket path, it calls `getSocketPath()` and gets `string | undefined`. If the value is `undefined`, the caller should use the default socket path (handled by `sendCommand` when `socketPathOverride` is undefined).
- The `|| undefined` pattern in `getSocketPath()` is a belt-and-suspenders: `get<string>()` without a default already returns `undefined` for unset optional string properties. The `|| undefined` handles the edge case where VS Code returns `''` (which it does for string settings with `"default": ""`).

## Escape hatches

- If other modules import `getSocketPath` and depend on the `string` return type: add them to the scope and update their type annotations. Verify none exist by running `rg "getSocketPath" src/`.
