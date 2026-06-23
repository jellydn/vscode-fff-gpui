# Changelog

All notable changes to the "vscode-fff-gpui" extension will be documented in this file.

## [0.1.4] — 2026-06-23

### Added
- **Pick from Git Status** command (`Cmd+K Cmd+S`) — fuzzy-pick modified, staged, and untracked files from `git status`
- **Find TODO/FIXME** command (`Cmd+K Cmd+T`) — search TODO, FIXME, HACK, and FIX comments via ripgrep, open matches in fff-gpui

### Fixed
- CI publish workflow: switch from Entra ID OIDC to PAT-based auth with version-bump gate (stabilized across 0.1.4–0.1.6)

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
