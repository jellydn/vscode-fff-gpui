# 4. Module depth: transport/protocol separation, type guard colocation, pure path resolution

Date: 2026-06-23

## Status

Accepted

## Context

After completing the KISS refactor (8 commands → 2 commands), the codebase was lean but had architectural shallowness in three areas:

1. **`client.ts` bundled five concerns** — socket lifecycle, chunked streaming, JSON parsing, schema validation, and error taxonomy — into one `sendCommand()` function (~130 lines). Testing protocol behavior required mocking `node:net` socket event emitters.

2. **Type guards lived in `client.ts`, types in `types.ts`** — `isPickEntry()` and `isPickResponse()` were private functions in the socket client module, separated from the `PickEntry`/`PickResponse` interfaces they validate. Protocol schema changes required editing two modules.

3. **Workspace Root resolution was inlined in `runPicker.ts`** — the 3-level cascade (workspace folder → editor directory → homedir) had no independent interface. Tests verified it indirectly by spying on `sendCommand()` arguments, requiring heavy VS Code workspace/editor state mocks.

A codebase architecture review applied the vocabulary of module depth, seams, leverage, and locality to identify deepening opportunities. Three candidates were selected for implementation.

## Decision

**Implement three architectural deepenings with high leverage-to-effort ratios:**

### 1. Separate IPC transport from protocol (module depth)

Create `src/ipc.ts` as a transport module:

```typescript
// ipc.ts — raw Unix socket transport
export function sendSocketMessage(socketPath: string, payload: string): Promise<string>;
```

The module owns the socket lifecycle (connect, write, chunk assembly, timeout) and returns raw response text. It has no awareness of the daemon protocol — no JSON parsing, no schema validation, no error taxonomy.

`client.ts` becomes a protocol adapter:

```typescript
// client.ts — protocol client
export async function sendCommand(
  command,
  socketPathOverride?,
  workspaceRoot?,
): Promise<PickResponse>;
```

It serializes the `ServiceCommand`, calls `sendSocketMessage`, parses JSON, validates with `isPickResponse`, and classifies errors (ENOENT/ECONNREFUSED → daemon not running, JSON parse failure → truncated message, schema mismatch → invalid response).

**Seam**: The transport is now swappable — a mock, a test double, or a different socket library can sit behind the `sendSocketMessage` interface without touching the protocol layer.

### 2. Colocate type guards with type definitions (locality)

Move `isPickEntry()` and `isPickResponse()` from `client.ts` to `types.ts`, making them exported. The module deepens from "compile-time types only" to "compile-time types + runtime validation" — both aspects of the same concern (the daemon protocol schema). Protocol schema changes become single-file edits.

### 3. Extract Workspace Root resolution as a pure function (locality + leverage)

Create `src/commands/resolveSearchPath.ts`:

```typescript
export interface SearchContext {
  workspaceFolders: readonly { uri: { fsPath: string } }[] | undefined;
  activeEditor: { document: { uri: { fsPath: string; scheme: string } } } | undefined;
  homedir: string;
}

export function resolveSearchTarget(ctx: SearchContext): string;
```

The cascade logic (workspace → editor dir → homedir) moves from an inline block in `runPicker.ts` to a standalone pure function with a defined interface. `runPicker.ts` becomes an orchestrator that delegates to `resolveSearchTarget`, `sendCommand`, and `openFiles`.

## Consequences

### Positive

- **Transport is independently testable** — `sendSocketMessage` has 8 targeted tests covering connect, write, chunk assembly, timeout, and error propagation. No protocol knowledge required.
- **Protocol is independently testable** — `sendCommand` tests verify JSON parsing, schema validation, and error taxonomy without concern for how bytes travel over the socket.
- **Type guards are independently testable** — `isPickEntry` and `isPickResponse` are pure functions of unknown input that can be tested with plain objects.
- **Path resolution is independently testable** — `resolveSearchTarget` has 6 pure unit tests with zero mocks (POJOs in, strings out).
- **Single-responsibility modules** — `ipc.ts` (transport), `client.ts` (protocol), `types.ts` (schema), `resolveSearchPath.ts` (path cascade) each have one clear concern.
- **Zero API changes** — all modules expose the same interfaces to their existing callers. `runPicker.ts` and `sendCommand` callers are unchanged.
- **Tests increased from 54 to 68** — 14 new targeted tests for the deepened modules, all pure-function or single-mock tests.

### Negative

- **More files** — 3 new source files and 2 new test files. Navigating the codebase requires knowing which module owns which concern.
- **`isPickEntry` is exported but only called by `isPickResponse`** — slightly wider interface than strictly needed. Mitigated by colocation: both live in the same module.
- **`SearchContext` interface couples to VS Code shape** — the interface mirrors `vscode.workspace.workspaceFolders` and `vscode.window.activeTextEditor` shapes. If VS Code changes these types, `SearchContext` must follow. This is acceptable because the type already exists in the VS Code API; `SearchContext` just makes it explicit.

### Comparison

| Before                                | After                                         | Winner |
| ------------------------------------- | --------------------------------------------- | ------ |
| `sendCommand` handles socket + JSON   | `ipc.ts` (transport) + `client.ts` (protocol) | After  |
| Type guards private in `client.ts`    | Type guards exported from `types.ts`          | After  |
| Path resolution inline in `runPicker` | `resolveSearchTarget` pure function           | After  |
| 54 tests, heavy mock setup            | 68 tests, pure function + targeted mocks      | After  |
| 7 source files                        | 10 source files                               | Before |

The file count increase is accepted as the price of deepening — each new module has a single, clearly-defined concern with an independently testable interface.

## References

- Architecture review report: `architecture-review-20260623.html`
- Codebase map: `.planning/codebase/ARCHITECTURE.md`
- Related: ADR 001 (Unix socket IPC), ADR 002 (config API), ADR 003 (command registration)
