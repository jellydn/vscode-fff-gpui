# TESTING.md — Testing Patterns

## Framework

- **Vitest 4** (requires `vite 8` as peer dependency)
- **Environment**: `node`
- **Config**: `vitest.config.ts` — includes `test/**/*.test.ts`

## Test Files

| File                    | Tests | Focus                                                                                       |
| ----------------------- | ----- | ------------------------------------------------------------------------------------------- |
| `test/client.test.ts`   | 25    | Socket IPC, response parsing, error handling, socket path resolution, security              |
| `test/commands.test.ts` | 29    | Command handlers, search path resolution, file opening, cursor positioning, fault tolerance |

**Total**: 54 tests across 2 files

## Test Structure

### test/client.test.ts

- **Mocked modules**: `node:net`, `node:fs`, `node:os`, `../src/logger`
- **Test suites**: `sendCommand`, `resolveSocketPath`, `verifySocketSecurity`

#### sendCommand tests

- Sends properly formatted JSON on connect
- Resolves with empty paths for empty response
- Parses valid PickResponse with paths and line/column
- Rejects on ENOENT (socket missing)
- Rejects on ECONNREFUSED (daemon not listening)
- Rejects on malformed JSON
- Rejects on invalid response shape (empty object, null paths, missing path, non-string path, non-numeric line)
- Accepts valid entries with string path and numeric line/column
- Rejects on socket timeout
- Uses socketPath override
- Differentiates ENOENT (socket file missing) vs ECONNREFUSED (file exists, no daemon)

#### resolveSocketPath tests

- Expands `~` to homedir
- Resolves relative paths with workspaceRoot
- Resolves relative paths with homedir fallback
- Preserves absolute paths
- Expands `${workspaceFolder}` with workspaceRoot
- Leaves `${workspaceFolder}` as-is without workspaceRoot

#### verifySocketSecurity tests

- Passes if path doesn't exist (ENOENT)
- Throws if not a socket
- Throws if not owned by current user
- Throws if world-writable
- Passes for secure socket (correct owner, 0o600)

### test/commands.test.ts

- **Mocked modules**: `../src/client`, `../src/config`, `node:os`, `vscode`
- **Hoisted state**: `sendCommandMock`, `getSocketPathMock`, `showErrorMessageMock`, `showWarningMessageMock`, `showTextDocumentMock`, `openTextDocumentMock`, `mockState` (workspaceFolders, activeTextEditor)
- **Test suites**: `findFiles`, `grepFiles`, `openFiles`

#### findFiles + grepFiles tests

- Search path resolution: workspace → editor dir → homedir (3 cases each)
- Falls back to homedir when active editor has non-file scheme
- Sends correct `in_grep` flag (false for find, true for grep)
- Passes custom socket path from config
- Passes undefined when config returns empty string
- Opens files from response paths
- Handles empty paths response gracefully
- Shows error message on sendCommand failure
- Does not attempt to open files on error

#### openFiles tests

- Returns immediately for empty entries
- Loads all documents in parallel
- Opens documents with `preview: false`
- Positions cursor at line/column (1-indexed → 0-indexed conversion)
- Handles entries without line/column gracefully
- Partial failure: opens remaining files, shows warning with count
- All-fail: shows warning, no documents opened
- Show stage failure isolation: other files still open
- Clamps line: 0 to index 0
- Opens multiple files and shows all of them with correct cursor positions

## Mocking Pattern

### Hoisted State Pattern (used in commands.test.ts)

State that needs to be mutable from both mock factories and test bodies is hoisted:

```typescript
const { sendCommandMock, mockState } = vi.hoisted(() => ({
  sendCommandMock: vi.fn(),
  mockState: {
    workspaceFolders: undefined as ... | undefined,
    activeTextEditor: undefined as ... | undefined,
  },
}))

vi.mock('../src/client', () => ({
  sendCommand: sendCommandMock,  // references hoisted mock
}))
```

This avoids the limitation of `vi.mock()` being hoisted above all imports — the hoisted state is available before the mock factory runs.

### Direct vi.mock() (used in client.test.ts)

For simple mocks where state doesn't need mutation from tests:

```typescript
vi.mock("node:net");
vi.mock("node:fs", () => ({
  statSync: vi.fn().mockImplementation(() => {
    throw enoentErr;
  }),
  existsSync: vi.fn().mockReturnValue(false),
}));
```

## Running Tests

```bash
pnpm test              # Vitest run (single pass)
pnpm test:watch        # Vitest watch mode
```

Run from CI: `pnpm lint && pnpm typecheck && pnpm test`

## Test Coverage Notes

- No coverage thresholds configured
- All error paths are tested (ENOENT, ECONNREFUSED, timeout, invalid JSON, malformed shape)
- All search path fallbacks are tested
- Fault tolerance (partial failure, all-fail, show failures) is tested
- Edge cases (line: 0, non-file scheme, empty config) covered
