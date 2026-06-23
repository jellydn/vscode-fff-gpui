# 1. Direct Unix socket IPC instead of CLI child process

Date: 2026-06-23

## Status

Accepted

## Context

fff-gpui has two ways to trigger a file picker from an external tool:

1. **CLI client**: Run `fff-gpui --open <path>`. The CLI connects to the daemon's Unix socket, waits for a `PickResponse`, then spawns `$EDITOR` (or `$VISUAL`, or config.editor) to open the selected files. This is how Zed integrates — it sets `EDITOR=zed` in the task environment.

2. **Direct socket**: Connect to `~/.local/state/fff-gpui/fff-gpui.sock`, send a JSON `ServiceCommand`, and read back a `PickResponse`. The client is responsible for opening files itself.

For the VS Code extension, we needed to decide which approach to use.

## Decision

**Use direct Unix socket IPC** via Node.js `net.createConnection()`, bypassing the CLI client entirely.

We connect to the daemon socket, send `{"cmd":"open_path","path":"<workspace>","in_grep":false}`, and read back a JSON `PickResponse`. Files are opened via `vscode.workspace.openTextDocument()` + `vscode.window.showTextDocument()`.

## Consequences

### Positive

- Files always open in VS Code — never in whatever `$EDITOR` happens to be set. No need to set or override environment variables.
- No child process to manage. No terminal, no shell, no PID file watching (contrast with vscode-fzf-picker which uses hidden terminals).
- Simple protocol: one write, one read, socket closes. ~50 lines of TypeScript.
- Reuses the existing daemon's shared file index — no cold start on each search.
- Works even if `fff-gpui` isn't on `$PATH` (the socket path is at a fixed location under `$HOME`).

### Negative

- Assumes the daemon is already running (`brew services start fff-gpui`). If not, the extension shows an error with install instructions.
- Socket path is hardcoded to `~/.local/state/fff-gpui/fff-gpui.sock`. If fff-gpui ever changes this, the extension needs updating (mitigated by the `fff-gpui.socketPath` config option).
- Protocol is undocumented outside the Rust source code (`src/service.rs`). Any breaking changes to `ServiceCommand` or `PickResponse` schemas could break the extension.
- macOS-only (fff-gpui itself is macOS-only).

### Comparison

| Approach                  | Editor spawning    | Process mgmt   | Shared index    | Protocol complexity     |
| ------------------------- | ------------------ | -------------- | --------------- | ----------------------- |
| CLI child process         | Via `$EDITOR`      | Need to manage | Yes (daemon)    | CLI args + stdout parse |
| Direct socket             | Extension controls | None           | Yes (daemon)    | JSON line protocol      |
| Child process `--std-out` | Extension controls | Need to manage | No (cold index) | stdout parse            |

Direct socket wins on simplicity, shared index reuse, and IDE-native file opening.
