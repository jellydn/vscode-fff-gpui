# ARCHITECTURE.md — System Architecture

## Overview

vscode-fff-gpui is a thin bridge between VS Code and the fff-gpui native picker daemon. It has exactly 2 user-facing commands, each following the same flow: resolve search path → send command to daemon via Unix socket → open returned files in VS Code.

## Architectural Pattern

**Command-Dispatcher → Client → File Opener** — a linear pipeline with shared infrastructure.

```
┌─────────────────────────────────────┐
│           extension.ts              │
│  defineExtension + 2 useCommand     │
│  (reactive-vscode lifecycle)        │
└──────────┬──────────────┬───────────┘
           │              │
     ┌─────▼─────┐  ┌────▼──────┐
     │ findFiles │  │ grepFiles │
     │ inGrep:false│  │ inGrep:true│
     └─────┬──────┘  └────┬──────┘
           │              │
           └──────┬───────┘
                  │
          ┌───────▼───────┐
          │   runPicker   │  ← Shared picker runner
          │  (resolve     │
          │   path,       │
          │   statusTip,  │
          │   catch)      │
          └───────┬───────┘
                  │
          ┌───────▼───────┐
          │   sendCommand │  ← Unix socket IPC
          │  (connect,    │     (client.ts)
          │   write JSON, │
          │   read+parse) │
          └───────┬───────┘
                  │
          ┌───────▼───────┐
          │   openFiles   │  ← Document opener
          │  (load docs,  │     (openFiles.ts)
          │   show docs,  │
          │   position)   │
          └───────────────┘
```

## Layers

### 1. Extension Entry (`src/extension.ts`)

- Uses `reactive-vscode`'s `defineExtension` + `useCommand` for declarative lifecycle
- Registers 2 commands: `fff-gpui.findFiles` and `fff-gpui.grepFiles`
- Activates on command invocation (not on startup)
- Logs activation/deactivation to the fff-gpui output channel
- Cleanup: disposes the output channel logger on deactivation

### 2. Command Handlers (`src/commands/findFiles.ts`, `src/commands/grepFiles.ts`)

- Thin wrappers — each is ~7 lines
- Both call the shared `runPicker()` with different options
- `findFiles`: `inGrep: false`, status tip for globs/git patterns
- `grepFiles`: `inGrep: true`, status tip for search patterns

### 3. Shared Picker Runner (`src/commands/runPicker.ts`)

- Resolves search path: workspace root → active editor directory → home directory
- Shows a status bar hint (8s timeout) with contextual tips
- Calls `sendCommand()` with the resolved path and grep flag
- Passes results to `openFiles()`
- Catches and displays errors via `vscode.window.showErrorMessage`

### 4. Unix Socket Client (`src/client.ts`)

- `sendCommand()` — connects to daemon socket, sends JSON, reads response
- `resolveSocketPath()` — expands `~`, `${workspaceFolder}`, relative paths
- `verifySocketSecurity()` — owner check + world-writable check
- `isPickResponse()` — type guard validating daemon response shape
- `isPickEntry()` — type guard validating individual entry shape
- Error taxonomy: ENOENT/ECONNREFUSED (daemon not running), invalid JSON (parse error), invalid shape (validation error), timeout (60s)

### 5. Document Opener (`src/commands/openFiles.ts`)

- Loads documents in parallel via `Promise.allSettled` (fault-tolerant)
- Shows documents with `preview: false` (tabs remain open)
- Converts 1-indexed line/column from daemon to 0-indexed VS Code positions
- Partial failure: shows warning with count, opens remaining files
- Show stage also uses `Promise.allSettled` for failure isolation

### 6. Configuration (`src/config.ts`)

- `getSocketPath()` — reads `fff-gpui.socketPath` from VS Code configuration
- Uses plain `vscode.workspace.getConfiguration()` (not reactive-vscode, see ADR 002)

### 7. Logger (`src/logger.ts`)

- Singleton `vscode.OutputChannel` named "fff-gpui"
- `log(message)` — appends timestamped message
- `disposeLogger()` — disposes channel on extension deactivation

## Data Flow

### Find Files Flow

```
User presses Cmd+K Cmd+P
  → VS Code invokes fff-gpui.findFiles
    → useCommand handler calls findFiles()
      → runPicker({ inGrep: false, statusTip: "..." })
        → resolve search path (workspace folder)
        → show status bar hint
        → sendCommand({ cmd: "open_path", path: "/workspace", in_grep: false })
          → resolveSocketPath()
          → verifySocketSecurity()
          → net.createConnection(socketPath)
          → socket.write(JSON)
          → read response data
          → socket.end → parse JSON → isPickResponse() validation
          → return PickResponse { paths: [{path, line?, column?}, ...] }
        → openFiles(response.paths)
          → Promise.allSettled(openTextDocument) over all entries
          → Pair entries with successful docs
          → Promise.allSettled(showTextDocument) over all pairs
          → Position cursor (1-indexed → 0-indexed)
```

### Grep Files Flow

Identical to find files, except `inGrep: true` and different status tip.

## Key Design Decisions

1. **Direct Unix socket, not CLI child process** (ADR 001) — Files open in VS Code, not `$EDITOR`
2. **Plain VS Code API for config** (ADR 002) — Avoided `reactive-vscode` type inference issues
3. **reactive-vscode for commands** (ADR 003) — Matches Jellydn extension conventions
4. **KISS: 2 commands, 1 config** — Daemon handles everything natively; extension is just a bridge
5. **Fault-tolerant loading** — `Promise.allSettled` throughout; no single bad path breaks the batch
6. **PickResponse validation** — Type guards reject malformed daemon responses before they reach file opening
