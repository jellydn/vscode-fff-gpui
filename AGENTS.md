# AGENTS.md — vscode-fff-gpui

## Project

VS Code extension that delegates file finding/grep to the native `fff-gpui` TUI picker daemon via Unix socket. Uses `reactive-vscode` for the VS Code extension lifecycle.

User installs `fff-gpui` separately: `brew install fff-gpui && brew services start fff-gpui`

## Commands

| Script                      | Action                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm build`                | tsup bundle `src/extension.ts` → `dist/extension.js` (CJS)                                   |
| `pnpm dev`                  | tsup watch mode                                                                              |
| `pnpm lint`                 | Biome check                                                                                  |
| `pnpm lint:fix`             | Biome check --write                                                                          |
| `pnpm lint:fix -- --unsafe` | Biome check --write --unsafe (auto-fix unused imports/unused vars)                           |
| `pnpm typecheck`            | `tsc --noEmit`                                                                               |
| `pnpm test`                 | Vitest run                                                                                   |
| `pnpm test:watch`           | Vitest watch mode                                                                            |
| `pnpm package`              | `vsce package --no-dependencies`                                                             |
| `pnpm publish`              | `vsce publish --no-dependencies`                                                             |
| `pnpm bump`                 | `bumpp` version bump                                                                         |
| `pnpm release`              | `bash scripts/release.sh` (lint → typecheck → test → build, then publish to both registries) |
| `pnpm release:dry`          | dry run of release pipeline                                                                  |

Always run in order: `lint → typecheck → test` before building/releasing.

## Biome (lint + format)

- No semicolons, single quotes, trailing commas
- 2-space indent, 100 col width
- `noExplicitAny` off, `useImportType` error
- Checked paths: `**/src/**/*.ts`, `**/test/**/*.ts`, `**/tsup.config.ts`, `**/vitest.config.ts`
- `lint:fix --unsafe` auto-removes unused imports and renames unused catch vars

## Architecture

- `src/extension.ts` — entrypoint. Registers two commands: `findFiles`, `grepFiles`.
- `src/config.ts` — reads `fff-gpui.socketPath` VS Code setting.
- `src/ipc.ts` — `sendSocketMessage(socketPath, payload)` — raw Unix socket transport (connect, write, read chunks, 60s timeout). Single-export module, no protocol awareness.
- `src/client.ts` — `sendCommand()` is the protocol adapter: serializes `ServiceCommand`, calls `sendSocketMessage`, parses JSON, validates with `isPickResponse`. Also exports `resolveSocketPath()` (supports `${workspaceFolder}`, `~`, relative, absolute paths) and `verifySocketSecurity()` (owner check + world-writable check).
- `src/commands/findFiles.ts` / `grepFiles.ts` — thin wrappers calling shared `runPicker({ inGrep, statusTip })`.
- `src/commands/runPicker.ts` — shared picker orchestration: delegates path resolution to `resolveSearchTarget`, shows status bar hint, calls `sendCommand`, passes results to `openFiles`, catches errors.
- `src/commands/resolveSearchPath.ts` — `resolveSearchTarget(ctx)` — pure function: workspace root → active editor dir → homedir. Interface: `(SearchContext) → string`.
- `src/commands/openFiles.ts` — opens documents, converts 1-indexed line/col from daemon to 0-indexed. Fault-tolerant load stage (Promise.allSettled).
- `src/types.ts` — `ServiceCommand`, `PickEntry`, `PickResponse` interfaces + `isPickEntry()`, `isPickResponse()` runtime type guards (colocated).
- `src/logger.ts` — VS Code OutputChannel logger.

Keybindings: `cmd+k cmd+p` (find), `cmd+k cmd+f` (grep)

## Testing

- Test files: `test/ipc.test.ts` (socket transport), `test/client.test.ts` (protocol client + security), `test/commands.test.ts` (find, grep, open), `test/resolveSearchPath.test.ts` (path resolution), `test/types.test.ts` (type guards). 91 tests total.
- Mocks `node:net` globally via `vi.mock('node:net')` (ipc.test.ts, client.test.ts). `resolveSearchPath.test.ts` and `types.test.ts` use zero-mock pure function tests.
- Tests: socket transport (connect/write/read/timeout), protocol client (sendCommand, JSON parsing, PickResponse validation, error taxonomy), socket path resolution, security verification, search path resolution (workspace → editor → homedir cascade), type guard validation (isPickEntry/isPickResponse), file opening (cursor positioning, partial failure, fault tolerance).
- Runs in `node` environment (vitest.config.ts)

## Known quirks

- `package` and `publish` use `--no-dependencies` because tsup already bundles `reactive-vscode` via `noExternal`. Allowing vsce to bundle it would cause a double-bundle or duplicate dependency issue.
- `.npmrc` uses `only-built-dependencies[]` for `@vscode/vsce-sign` and `keytar` — required for pnpm to build these native deps during `vsce package`.
- `resolveSocketPath()` expands `${workspaceFolder}` as a literal string, not VS Code's native variable — users should write `${workspaceFolder}` in their `fff-gpui.socketPath` setting.
- Extension handles missing workspace folders gracefully (falls back to active editor directory, then home dir).
- vitest 4.x requires `vite` as a peer dependency (vite 8.x installed).
