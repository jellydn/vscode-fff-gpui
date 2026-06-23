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
- `src/client.ts` — `sendCommand()` writes JSON to Unix socket, returns selected file paths. 60s timeout. Includes `verifySocketSecurity()` (owner check + world-writable check). Socket path resolution supports `${workspaceFolder}`, `~`, relative, and absolute paths.
- `src/commands/findFiles.ts` / `grepFiles.ts` — thin wrappers calling shared `runPicker({ inGrep, statusTip })`, then `openFiles()`.
- `src/commands/runPicker.ts` — shared picker runner: resolves search path (workspace → editor dir → homedir), sends command to daemon, opens results.
- `src/commands/openFiles.ts` — opens documents, converts 1-indexed line/col from daemon to 0-indexed. Fault-tolerant load stage (Promise.allSettled).
- `src/types.ts` — `ServiceCommand`, `PickEntry`, `PickResponse`.
- `src/logger.ts` — VS Code OutputChannel logger.

Keybindings: `cmd+k cmd+p` (find), `cmd+k cmd+f` (grep)

## Testing

- Test files: `test/client.test.ts` (socket IPC), `test/commands.test.ts` (find, grep, open)
- Mocks `node:net` globally via `vi.mock('node:net')`
- Tests: socket connect/write, JSON parsing, PickResponse validation, error handling (ENOENT, ECONNREFUSED, timeout, invalid JSON, malformed response), socket path resolution, security verification, search path resolution, file opening (cursor positioning, partial failure, fault tolerance)
- Runs in `node` environment (vitest.config.ts)

## Known quirks

- `package` and `publish` use `--no-dependencies` because tsup already bundles `reactive-vscode` via `noExternal`. Allowing vsce to bundle it would cause a double-bundle or duplicate dependency issue.
- `.npmrc` uses `only-built-dependencies[]` for `@vscode/vsce-sign` and `keytar` — required for pnpm to build these native deps during `vsce package`.
- `resolveSocketPath()` expands `${workspaceFolder}` as a literal string, not VS Code's native variable — users should write `${workspaceFolder}` in their `fff-gpui.socketPath` setting.
- Extension handles missing workspace folders gracefully (falls back to active editor directory, then home dir).
- vitest 4.x requires `vite` as a peer dependency (vite 6.x installed).
