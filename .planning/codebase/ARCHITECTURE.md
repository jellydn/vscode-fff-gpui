# Architecture

**Analysis Date:** 2026-06-23

## Pattern Overview

**Overall:** Thin VS Code extension adapter with command handlers, a Unix-socket client boundary, and daemon-owned picker UI.

**Key Characteristics:**

- VS Code lifecycle and command registration are centralized in `src/extension.ts` using `reactive-vscode`'s `defineExtension` and `useCommand`.
- User-facing commands in `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`, `src/commands/resumeSearch.ts`, and `src/commands/runCustomTask.ts` are small orchestration functions around VS Code APIs.
- The native `fff-gpui` daemon integration is isolated in `src/client.ts`, which resolves and verifies a Unix socket, sends newline-delimited JSON, waits for the daemon response, and returns typed picks from `src/types.ts`.
- File-opening side effects are isolated in `src/commands/openFiles.ts`, so command handlers do not directly manage document loading, editor selection, or multi-file error isolation.
- Extension configuration is exposed through `package.json` and read through `src/config.ts`; the `fff-gpui.socketPath` setting is consumed by `src/commands/findFiles.ts` and `src/commands/grepFiles.ts` before calling `src/client.ts`.

## Layers

**VS Code Contribution Manifest:**

- Purpose: Declares extension activation, commands, keybindings, settings, packaging entrypoint, scripts, dependencies, and marketplace metadata.
- Location: `package.json`
- Contains: `activationEvents`, `contributes.commands`, `contributes.keybindings`, `contributes.configuration`, `main`, `scripts`, dependencies.
- Depends on: VS Code extension manifest schema and the bundled `dist/extension.js` entrypoint produced from `src/extension.ts`.
- Used by: VS Code at install/activation time and development commands such as `npm run build`, `npm run lint`, `npm run typecheck`, and `npm test`.

**Extension Lifecycle and Command Registration:**

- Purpose: Activates the extension, registers command callbacks, records the latest search kind, delegates command work, and disposes logging on deactivation.
- Location: `src/extension.ts`
- Contains: `activate`/`deactivate` export from `defineExtension`, six `useCommand` registrations, logging calls, and calls into command modules.
- Depends on: `reactive-vscode`, `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`, `src/commands/resumeSearch.ts`, `src/commands/runCustomTask.ts`, and `src/logger.ts`.
- Used by: VS Code through `package.json`'s `main` and activation events for commands such as `fff-gpui.findFiles` and `fff-gpui.grepFiles`.

**Command Orchestration:**

- Purpose: Converts VS Code command invocations into search paths, status messages, daemon requests, file-opening actions, search-cache updates, or terminal task execution.
- Location: `src/commands/`
- Contains: `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`, `src/commands/openFiles.ts`, `src/commands/resumeSearch.ts`, and `src/commands/runCustomTask.ts`.
- Depends on: VS Code APIs, Node `os`/`path`, `src/client.ts`, `src/config.ts`, `src/types.ts`, and `src/logger.ts`.
- Used by: Command registrations in `src/extension.ts`.

**Daemon Client Boundary:**

- Purpose: Owns all Unix socket communication with the native `fff-gpui` daemon and normalizes daemon errors into extension-level errors.
- Location: `src/client.ts`
- Contains: socket-path defaulting and resolution, socket security checks, `sendCommand()`, socket event handlers, JSON serialization/parsing, and 60-second timeout handling.
- Depends on: Node `fs`, `net`, `os`, `path`, and protocol types from `src/types.ts`.
- Used by: `src/commands/findFiles.ts` and `src/commands/grepFiles.ts`.

**Configuration Access:**

- Purpose: Provides a typed helper for reading the extension's custom socket-path setting from VS Code workspace configuration.
- Location: `src/config.ts`
- Contains: `getSocketPath()` reading `fff-gpui.socketPath`.
- Depends on: VS Code workspace configuration APIs.
- Used by: `src/commands/findFiles.ts` and `src/commands/grepFiles.ts`.

**Protocol Types:**

- Purpose: Defines the JSON command and response contracts exchanged between the VS Code extension and the native daemon.
- Location: `src/types.ts`
- Contains: `ServiceCommand`, `PickEntry`, and `PickResponse` interfaces.
- Depends on: No runtime dependencies.
- Used by: `src/client.ts` and `src/commands/openFiles.ts`.

**Logging:**

- Purpose: Provides a lazy VS Code output channel for activation, command invocation, search caching, and deactivation messages.
- Location: `src/logger.ts`
- Contains: `log()` and `disposeLogger()`.
- Depends on: VS Code `window.createOutputChannel` API.
- Used by: `src/extension.ts` and `src/commands/resumeSearch.ts`.

## Data Flow

**Find Files Command:**

1. VS Code exposes `fff-gpui.findFiles` via `package.json` and activates the extension when the command is invoked.
2. `src/extension.ts` handles the command with `useCommand('fff-gpui.findFiles', ...)`, logs the invocation, calls `saveSearch('files')` from `src/commands/resumeSearch.ts`, and awaits `findFiles()` from `src/commands/findFiles.ts`.
3. `src/commands/findFiles.ts` determines `searchPath` from `vscode.workspace.workspaceFolders?.[0]?.uri.fsPath`, falls back to the active editor directory, then falls back to `os.homedir()`.
4. `src/commands/findFiles.ts` displays a status-bar tip and calls `sendCommand({ cmd: 'open_path', path: searchPath, in_grep: false }, getSocketPath() || undefined, searchPath)`.
5. `src/config.ts` reads `fff-gpui.socketPath`; if absent, `src/client.ts` uses its default `~/.local/state/fff-gpui/fff-gpui.sock` path.
6. `src/client.ts` resolves `${workspaceFolder}`, `~`, and relative socket paths, verifies the target is a non-world-writable socket owned by the current user when present, and opens a Unix socket with `net.createConnection(socketPath)`.
7. On socket `connect`, `src/client.ts` writes the daemon command as `${JSON.stringify(command)}\n` to the native `fff-gpui` daemon.
8. The native daemon owns the TUI picker interaction and returns JSON such as `{ "paths": [{ "path": "...", "line": 1, "column": 1 }] }`; `src/client.ts` accumulates chunks until `end`, parses the trimmed JSON, and resolves a `PickResponse`.
9. `src/commands/findFiles.ts` passes `response.paths` to `openFiles()` in `src/commands/openFiles.ts`.
10. `src/commands/openFiles.ts` opens all selected paths with `vscode.workspace.openTextDocument(vscode.Uri.file(entry.path))`, then shows each document with `vscode.window.showTextDocument`, converting daemon-provided 1-indexed `line`/`column` values to 0-indexed `vscode.Selection` positions.

**Grep Files Command:**

1. VS Code exposes `fff-gpui.grepFiles` via `package.json` and invokes the registered callback in `src/extension.ts`.
2. `src/extension.ts` logs the invocation, calls `saveSearch('grep')` in `src/commands/resumeSearch.ts`, and awaits `grepFiles()` in `src/commands/grepFiles.ts`.
3. `src/commands/grepFiles.ts` computes the same workspace/editor/home `searchPath` fallback chain used by `src/commands/findFiles.ts`.
4. `src/commands/grepFiles.ts` displays a grep-specific status-bar tip and calls `sendCommand({ cmd: 'open_path', path: searchPath, in_grep: true }, getSocketPath() || undefined, searchPath)`.
5. `src/client.ts` uses the same Unix socket resolution, security verification, JSON write, response accumulation, parse, timeout, and daemon-error handling path as the find-files flow.
6. `src/commands/grepFiles.ts` passes selected grep results to `src/commands/openFiles.ts`, which opens files and positions the editor at optional daemon-provided line and column values.

**Resume Search Command:**

1. `src/extension.ts` calls `saveSearch()` in `src/commands/resumeSearch.ts` before find, grep, git-status, and TODO/FIXME commands.
2. When `fff-gpui.resumeSearch` is invoked, `src/extension.ts` calls `resumeSearch()` in `src/commands/resumeSearch.ts`.
3. `src/commands/resumeSearch.ts` shows an information message if no search is cached; otherwise it dynamically imports `src/commands/findFiles.ts` or `src/commands/grepFiles.ts` to avoid circular dependencies and repeats the appropriate daemon flow.

**Custom Task Command:**

1. VS Code exposes `fff-gpui.runCustomTask` via `package.json`; `src/extension.ts` invokes `runCustomTask()` in `src/commands/runCustomTask.ts`.
2. `src/commands/runCustomTask.ts` reads `fff-gpui.customTasks` from VS Code configuration, prompts with `vscode.window.showQuickPick`, creates a VS Code terminal, and sends the configured shell command.
3. This flow does not call `src/client.ts` and does not interact with the `fff-gpui` Unix socket.

**State Management:**

- Persistent user configuration is managed by VS Code settings declared in `package.json` and read by `src/config.ts` and `src/commands/runCustomTask.ts`.
- Runtime search history is a module-level `lastSearch` variable in `src/commands/resumeSearch.ts`; it lasts only for the extension host process and is not persisted across reloads.
- Logger state is a module-level `outputChannel` in `src/logger.ts`, lazily created on first log call and disposed by the deactivation callback in `src/extension.ts`.
- Daemon response state is local to each `sendCommand()` call in `src/client.ts` through the `data` accumulator string.

## Key Abstractions

**ServiceCommand:**

- Purpose: Represents commands sent from the extension to the native daemon, including `open_path` plus optional path and grep mode flags.
- Examples: `src/types.ts`, `src/client.ts`, `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`
- Pattern: Shared protocol DTO used at the process boundary.

**PickEntry and PickResponse:**

- Purpose: Represent daemon-selected files and optional cursor positions that the VS Code side can open.
- Examples: `src/types.ts`, `src/client.ts`, `src/commands/openFiles.ts`
- Pattern: Typed response DTO plus side-effect consumer.

**sendCommand():**

- Purpose: Encapsulates socket-path resolution, local socket validation, request serialization, response parsing, timeout handling, and daemon availability errors.
- Examples: `src/client.ts`, `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`
- Pattern: Infrastructure gateway / adapter around an external daemon.

**Command Modules:**

- Purpose: Keep each VS Code command's orchestration logic separated from lifecycle registration and daemon transport details.
- Examples: `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`, `src/commands/resumeSearch.ts`, `src/commands/runCustomTask.ts`
- Pattern: Command handler modules with small public async functions.

**openFiles():**

- Purpose: Converts daemon selections into VS Code document-open and editor-selection operations.
- Examples: `src/commands/openFiles.ts`, `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`
- Pattern: Side-effect service with parallel document loading and resilient display handling.

**Logger Output Channel:**

- Purpose: Centralizes extension diagnostics into a single VS Code output channel.
- Examples: `src/logger.ts`, `src/extension.ts`, `src/commands/resumeSearch.ts`
- Pattern: Lazy singleton wrapper around a VS Code resource.

## Entry Points

**Extension Activation:**

- Location: `src/extension.ts`
- Triggers: VS Code activation events declared in `package.json` for `fff-gpui.findFiles`, `fff-gpui.grepFiles`, `fff-gpui.pickFileFromGitStatus`, `fff-gpui.findTodoFixme`, `fff-gpui.resumeSearch`, and `fff-gpui.runCustomTask`.
- Responsibilities: Log activation, register command callbacks, delegate command work, and return a deactivation cleanup function.

**Find Files Command:**

- Location: `src/commands/findFiles.ts`
- Triggers: `fff-gpui.findFiles` and `fff-gpui.pickFileFromGitStatus` callbacks in `src/extension.ts`.
- Responsibilities: Determine search root, show usage tip, send `open_path` with `in_grep: false` to the daemon, and open returned files.

**Grep Files Command:**

- Location: `src/commands/grepFiles.ts`
- Triggers: `fff-gpui.grepFiles` and `fff-gpui.findTodoFixme` callbacks in `src/extension.ts`.
- Responsibilities: Determine search root, show grep tip, send `open_path` with `in_grep: true` to the daemon, and open returned files.

**Resume Search Command:**

- Location: `src/commands/resumeSearch.ts`
- Triggers: `fff-gpui.resumeSearch` callback in `src/extension.ts`.
- Responsibilities: Track the latest search kind, repeat the matching find or grep command, and avoid circular imports through dynamic imports.

**Run Custom Task Command:**

- Location: `src/commands/runCustomTask.ts`
- Triggers: `fff-gpui.runCustomTask` callback in `src/extension.ts`.
- Responsibilities: Read configured tasks, prompt for a task, and execute the selected command in a VS Code terminal.

## Error Handling

**Strategy:** Errors are handled at the boundary closest to user impact: `src/client.ts` normalizes socket/protocol failures, command handlers in `src/commands/findFiles.ts` and `src/commands/grepFiles.ts` display user-facing VS Code error messages, and `src/commands/openFiles.ts` prevents one failed editor display from blocking other selected files.

**Patterns:**

- `src/client.ts` rejects when the socket path exists but is not a socket, is owned by another user, or is world-writable.
- `src/client.ts` treats `ENOENT` and `ECONNREFUSED` as daemon-availability failures and returns an install/start hint for `fff-gpui`.
- `src/client.ts` resolves an empty daemon response as `{ paths: [] }` and rejects invalid JSON with the raw trimmed response included in the error message.
- `src/client.ts` uses `socket.setTimeout(60_000)`, destroys the socket on timeout, and rejects with `Connection timed out while waiting for file selection`.
- `src/commands/findFiles.ts` and `src/commands/grepFiles.ts` wrap the full daemon/open flow in `try`/`catch` and call `vscode.window.showErrorMessage` with a `fff-gpui:` prefix.
- `src/commands/openFiles.ts` uses `Promise.allSettled()` for `showTextDocument()` calls and logs individual failures to `console.warn` without aborting successful openings.
- `src/commands/resumeSearch.ts` reports missing in-memory search history with `vscode.window.showInformationMessage`.
- `src/commands/runCustomTask.ts` reports an empty `fff-gpui.customTasks` setting with `vscode.window.showInformationMessage` and returns early when the user cancels the quick pick.

## Cross-Cutting Concerns

**Logging:** `src/logger.ts` provides a lazy `fff-gpui` VS Code output channel. `src/extension.ts` logs activation, command invocation, and deactivation; `src/commands/resumeSearch.ts` logs cached search updates. `src/commands/openFiles.ts` uses `console.warn` for per-document display failures instead of the output channel.

**Validation:** `src/client.ts` validates socket path characteristics before connecting, `src/client.ts` validates daemon JSON by parsing into the `PickResponse` shape at runtime, `src/commands/openFiles.ts` clamps line and column values to zero or greater, `src/commands/runCustomTask.ts` checks for empty task configuration and missing selection, and `src/commands/findFiles.ts` plus `src/commands/grepFiles.ts` validate usable search roots through workspace/editor/home fallbacks.

**Authentication:** There is no application-level authentication in the extension source. Trust is based on local Unix socket filesystem controls in `src/client.ts`, specifically current-user ownership checks and rejection of world-writable sockets before daemon communication.

---

_Architecture analysis: 2026-06-23_
