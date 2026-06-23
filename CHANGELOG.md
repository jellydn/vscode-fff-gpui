# Changelog

All notable changes to the "vscode-fff-gpui" extension will be documented in this file.

## [0.1.7] — 2026-06-23

### KISS Refactor — lean on the daemon, not external tools

This release strips away external search dependencies by leaning on `fff-gpui`'s native capabilities. The daemon already handles glob filtering (`**/*.ts`), git-aware search (`git:modified`), and live grep — so the extension no longer shells out to `rg`, `git grep`, or `git status`.

### Removed

- **`rg` (ripgrep) dependency** — type-filtered commands (`findFilesWithType`, `grepFilesWithType`) removed. Users filter by type directly in the daemon's search bar via glob patterns (`**/*.rs`, `*.{ts,tsx}`, `!node_modules`).
- **`git grep` in findTodoFixme** — command now opens the daemon in grep mode instead. Users type `TODO` / `FIXME` in the search bar.
- **`git status` + `git ls-files` in pickGitStatus** — command now opens the daemon in file mode instead. Users type `git:modified`, `git:staged`, or `git:untracked` to filter by git status.
- **`src/commands/overlay.ts`** — temp-directory overlay system, dead code after the above simplifications.
- **`src/commands/typeFilter.ts`** — QuickPick type selector, no longer needed.

### Changed

- **8 commands → 6 commands**, powered by only **2 source files** (`findFiles.ts` + `grepFiles.ts`)
- `findTodoFixme` delegates to `grepFiles()` (both open grep mode)
- `pickFileFromGitStatus` delegates to `findFiles()` (both open file mode)
- Command titles updated to reflect current behavior:
  - `Find TODO/FIXME` → `Search TODO/FIXME`
  - `Pick File from Git Status` → `Find Files (type git:modified to see changes)`
- **Status bar hints** — brief tips about glob filtering and grep modes appear when the daemon window opens (8-second timeout)

### Result

- **Zero external search dependencies** — everything runs through the `fff-gpui` daemon
- **52 tests** across 4 test files, all passing
- **~40% fewer source lines** — same user-facing commands, less code

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
