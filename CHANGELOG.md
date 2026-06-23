# Changelog

All notable changes to the "vscode-fff-gpui" extension will be documented in this file.

## [0.2.2] — 2026-06-23

### Architecture Deepenings

Three module-depth improvements from an architecture review — each module now has a single concern with an independently testable interface.

#### Transport/Protocol Separation

- **`src/ipc.ts`** (new) — `sendSocketMessage(socketPath, payload): Promise<string>` raw Unix socket transport. Owns connect, write, chunk assembly, and 60s timeout. One-function interface.
- **`src/client.ts`** — `sendCommand()` refactored to async orchestrator: resolve path → verify security → `sendSocketMessage` → JSON.parse → `isPickResponse` validation → error taxonomy. Transport is now a swappable seam.

#### Type Guard Colocation

- **`src/types.ts`** — now exports `isPickEntry()` and `isPickResponse()` (moved from `client.ts`). Protocol schema (types + runtime validators) lives in one module — schema changes are single-file edits.

#### Path Resolution Extraction

- **`src/commands/resolveSearchPath.ts`** (new) — `resolveSearchTarget(ctx: SearchContext): string` pure function. Workspace root → editor dir → homedir cascade now has its own interface and independent tests.

### Testing

- **91 tests** across **5 test files** (up from 54/2)
- `test/ipc.test.ts` — 8 socket transport tests
- `test/resolveSearchPath.test.ts` — 6 zero-mock pure function tests
- `test/types.test.ts` — 23 zero-mock pure function tests (`isPickEntry` + `isPickResponse`)
- `test/client.test.ts` and `test/commands.test.ts` — existing tests continue to pass unchanged

### Documentation

- **ADR 004** — Module depth: transport/protocol split, type guard colocation, pure path resolution
- **Codebase map** (`.planning/codebase/`) — refreshed to reflect new modules, test files, and architecture
- **AGENTS.md** — updated architecture and testing sections

## [0.2.1] — 2026-06-23

### Removed

- **`fff-gpui: Resume Last Search` + `Cmd+K Cmd+R`** — resume added complexity without a `query` field in the daemon protocol.
- **`fff-gpui: Run Custom Task`** — running arbitrary shell commands is outside the extension's scope.
- **`fff-gpui.customTasks` configuration setting** — removed along with the command.

### Added

- **Fault-tolerant file loading** — `openFiles()` load stage uses `Promise.allSettled`; one bad path no longer rejects the entire batch. User gets a warning with failure count.
- **PickResponse validation** — `isPickResponse()` type guard rejects malformed daemon responses before they reach `openFiles()`.
- **Truncated parse-error payload** — full daemon response logged to output channel, user-facing message limited to 100 characters.
- **Auto-generated README tables** — Commands and Configuration tables generated from `package.json` via `vscode-ext-gen` (`npm run update`).
- **Why just two commands?** section in README explaining the KISS philosophy.

### Changed

- **4 commands → 2 commands** — only `findFiles` (`Cmd+K Cmd+P`) and `grepFiles` (`Cmd+K Cmd+F`)
- **2 keybindings** — file mode + grep mode
- **1 config setting** — only `fff-gpui.socketPath`
- **54 tests** across 2 test files

## [0.2.0] — 2026-06-23

### KISS Refactor — lean on the daemon, not external tools

This release eliminates three external search dependencies (`rg`, `git grep`, `git status`) by leaning on `fff-gpui`'s native capabilities. The daemon already handles glob filtering (`**/*.ts`), git-aware search (`git:modified`), and live grep — so the extension no longer shells out to external tools.

### Removed

- **`rg` (ripgrep) dependency** — type-filtered commands deleted; users filter by glob patterns in the daemon's search bar
- **`git grep` + `git status` / `git ls-files`** — replaced by daemon's native grep and git-aware file modes
- **`pickFileFromGitStatus` command** — merged into `findFiles` (identical behavior)
- **`findTodoFixme` command** — merged into `grepFiles` (identical behavior)
- **`src/commands/overlay.ts`** — dead code, no remaining consumers
- **`src/commands/typeFilter.ts`** — QuickPick selector, no longer needed
- **`src/commands/findFilesWithType.ts`** — `findFilesWithType` + `grepFilesWithType` (rg-dependent)
- **`src/commands/findTodoFixme.ts`** — duplicate of `grepFiles`
- **`src/commands/pickGitStatus.ts`** — duplicate of `findFiles`
- **Total: 8 source files deleted**, 3 dependencies eliminated

### Changed

- **8 commands → 4 commands** powered by **2 source files** (`findFiles.ts` + `grepFiles.ts`)
- **Shared picker runner** — extracted `runPicker({ inGrep, statusTip })` from duplicate `findFiles`/`grepFiles` logic
- **PickResponse validation** — `isPickResponse()` type guard rejects malformed daemon responses before they reach `openFiles()`
- **Keybindings reduced** — 5 → 3 (`Cmd+K Cmd+P` for files, `Cmd+K Cmd+F` for grep, `Cmd+K Cmd+R` for resume)
- **Status bar hints** — brief tips about glob filtering, `git:modified`, and grep patterns (8-second timeout)

### Result

- **Zero external search dependencies** — everything runs through the `fff-gpui` daemon
- **58 tests** across 4 test files, all passing
- **~50% fewer source lines** — same user-facing capabilities, half the code
- **Simplified protocol issue** filed: [th0jensen/fff-gpui#10](https://github.com/th0jensen/fff-gpui/issues/10) (optional `query` field for pre-filled searches)

## [0.1.6] — 2026-06-23

### Fixed

- CI publish: correct Azure DevOps PAT scope (Marketplace → Manage) and explicit `registryUrl` for VS Code Marketplace (0.1.5 was an unpublished CI attempt)

## [0.1.4] — 2026-06-23

### Added

- **Pick from Git Status** command (`Cmd+K Cmd+S`) — fuzzy-pick modified, staged, and untracked files from `git status`
- **Find TODO/FIXME** command (`Cmd+K Cmd+T`) — search TODO, FIXME, HACK, and FIX comments via ripgrep, open matches in fff-gpui

### Changed

- CI publish: switch from Entra ID OIDC to PAT-based auth with version-bump gate
- README: add new commands to the commands table and keybindings

## [0.1.2] — 2026-06-23

### Fixed

- Correct marketplace links to use `vscode-fff-gpui` extension ID (was `fff-gpui`)

## [0.1.1] — 2026-06-23

_Initial marketplace release._

### Added

- **Find Files** command (`Cmd+K Cmd+P`) — fuzzy file search with frecency ranking via fff-gpui daemon
- **Grep Files** command (`Cmd+K Cmd+F`) — live grep with plain text, regex, and fuzzy modes
- Unix socket IPC client to communicate with the fff-gpui background daemon
- Multi-select file opening (Tab to select, Enter to open all)
- Parallel document loading with `Promise.allSettled` for failure isolation
- Smart search path fallback: workspace root → active editor directory → home directory
- Socket path variable expansion (`${workspaceFolder}`, `~`)
- Socket file ownership and permission verification for security
- `fff-gpui.socketPath` configuration setting
- Output channel logging to `fff-gpui` output panel
- Extension logo and README with usage, configuration, and troubleshooting docs

## [0.1.0] — 2026-06-22

_Pre-release (not published to marketplaces)._

### Added

- Initial extension scaffold with reactive-vscode lifecycle
- Unix socket IPC client with JSON protocol
- `fff-gpui.findFiles` and `fff-gpui.grepFiles` commands
- Workspace-scoped search delegation to fff-gpui daemon
- Full test suite (client, commands, open files)
- CI pipeline (lint, typecheck, test, build) via GitHub Actions
- Architecture Decision Records (`doc/adr/`)
- Project documentation (`README.md`, `AGENTS.md`)
