# AGENTS.md — vscode-fff-gpui

## Project

VS Code extension that delegates file finding/grep to the native `fff-gpui` TUI picker daemon via Unix socket. Uses `reactive-vscode` for the VS Code extension lifecycle.

User installs `fff-gpui` separately: `brew install fff-gpui && brew services start fff-gpui`

## Commands

| Script              | Action                                                     |
| ------------------- | ---------------------------------------------------------- |
| `npm run build`     | tsup bundle `src/extension.ts` → `dist/extension.js` (CJS) |
| `npm run dev`       | tsup watch mode                                            |
| `npm run lint`      | Biome check                                                |
| `npm run lint:fix`  | Biome check --write                                        |
| `npm run typecheck` | `tsc --noEmit` (src only, excludes test/)                  |
| `npm test`          | Vitest run                                                 |
| `npm run package`   | `vsce package`                                             |
| `npm run publish`   | `vsce publish`                                             |

Order: `lint && typecheck && test && build`

## Biome (lint + format)

- No semicolons, single quotes, trailing commas
- 2-space indent, 100 col width
- `noExplicitAny` off, `useImportType` error
- Checked paths: `src/**/*.ts`, `test/**/*.ts`, config files

## Architecture

- `src/extension.ts` — entrypoint. Registers two commands via `reactive-vscode`'s `defineExtension` + `useCommand`.
- `src/config.ts` — defines `fff-gpui.socketPath` setting (not yet consumed by client)
- `src/client.ts` — `sendCommand()` writes JSON to Unix socket at `~/.local/state/fff-gpui/fff-gpui.sock`, returns selected file paths. 60s timeout.
- `src/commands/findFiles.ts` / `grepFiles.ts` — both call `sendCommand({ cmd: 'open_path', path: workspaceRoot, in_grep: boolean })` then `openFiles()`.
- `src/commands/openFiles.ts` — opens documents via VS Code API, positions cursor at line/col (1-indexed from daemon, converted to 0-indexed).
- `src/types.ts` — `ServiceCommand`, `PickEntry`, `PickResponse` types.

Keybindings: `cmd+k cmd+p` (find), `cmd+k cmd+f` (grep)

## Testing

- Single test file: `test/client.test.ts`
- Mocks `node:net` module globally via `vi.mock('node:net')`
- Tests socket connect/write, response parsing, error handling (ENOENT, ECONNREFUSED, timeout, invalid JSON)
- Runs in `node` environment

## Known quirks

- `src/client.ts:resolveSocketPath()` ignores `fff-gpui.socketPath` config — hardcodes the default path. The config exists but is not wired.
- `test/` is excluded from `tsconfig.json` so `tsc --noEmit` won't typecheck tests. Use `vitest` to validate tests.
- Extension requires an open workspace folder — both commands error if `workspaceFolders` is empty.
