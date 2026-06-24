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
          ┌───────▼───────────┐
          │    runPicker      │  ← Shared picker orchestration
          │  (resolve path,   │
          │   statusTip,      │
          │   catch)          │
          └───────┬───────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
┌────▼─────┐ ┌───▼────────┐ ┌─▼──────────┐
│resolve   │ │ sendCommand│ │ openFiles   │
│SearchPath│ │ (client.ts)│ │ (openFiles) │
│ pure fn  │ │ protocol   │ │ doc opener  │
└──────────┘ └───┬────────┘ └─────────────┘
                  │
          ┌───────▼───────┐
          │ sendSocketMsg │  ← Raw Unix socket
          │   (ipc.ts)    │     transport
          │ connect,write │
          │ read,timeout  │
          └───────────────┘
```

## Layers

### 1. Extension Entry (`src/extension.ts`)

- Uses `reactive-vscode`'s `defineExtension` + `useCommand` for declarative lifecycle
- Registers 2 commands: `fff-gpui.findFiles` and `fff-gpui.grepFiles`
- Activates on command invocation (not on startup)
- Logs activation/deactivation to the fff-gpui output channel
- Status bar: creates a left-aligned `fff-gpui` button that opens the file picker on click
- Cleanup: disposes the status bar item and output channel logger on deactivation

### 2. Command Handlers (`src/commands/findFiles.ts`, `src/commands/grepFiles.ts`)

- Thin wrappers — each is ~7 lines
- Both call the shared `runPicker()` with different options
- `findFiles`: `inGrep: false`, status tip for globs/git patterns
- `grepFiles`: `inGrep: true`, status tip for search patterns

### 3. Shared Picker Orchestration (`src/commands/runPicker.ts`)

- Delegates Workspace Root resolution to `resolveSearchPath.ts`
- Shows a status bar hint (8s timeout) with contextual tips
- Calls `sendCommand()` with the resolved path and grep flag
- Passes results to `openFiles()`
- Catches and displays errors via `vscode.window.showErrorMessage`

### 3a. Path Resolution (`src/commands/resolveSearchPath.ts`)

- `resolveSearchTarget()` — pure function: workspace root → active editor directory → home directory
- Interface: `(SearchContext) → string` — accepts POJOs, no VS Code API dependencies
- Tested independently with plain objects — no mocks, no spies

### 4. Protocol Client (`src/client.ts`)

- `sendCommand()` — serializes command, calls transport, validates response
- `resolveSocketPath()` — expands `~`, `${workspaceFolder}`, relative paths
- `verifySocketSecurity()` — owner check + world-writable check
- Delegates raw socket communication to `src/ipc.ts`
- Error taxonomy: ENOENT/ECONNREFUSED (daemon not running), invalid JSON (parse error with truncation), invalid shape (validation error), timeout (60s)

### 4a. Socket Transport (`src/ipc.ts`)

- `sendSocketMessage(socketPath, payload)` — pure transport: connect, write, read chunks, timeout
- Single-export module with a 1-function interface
- No awareness of the daemon protocol — just raw payload in, raw response out

### 4b. Protocol Types + Guards (`src/types.ts`)

- `ServiceCommand`, `PickEntry`, `PickResponse` — compile-time interfaces
- `isPickEntry()`, `isPickResponse()` — runtime type guards (colocated with types)
- Schema changes touch one file — no type/validator drift

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
        → resolveSearchTarget({ workspaceFolders, activeEditor, homedir })
          → returns resolved Workspace Root
        → show status bar hint
        → sendCommand({ cmd: "open_path", path: workspaceRoot, in_grep: false })
          → resolveSocketPath()
          → verifySocketSecurity()
          → sendSocketMessage(socketPath, JSON.stringify(command))
            → net.createConnection(socketPath)
            → socket.write(payload + "\n")
            → read response chunks
            → socket.end → return raw string
          → JSON.parse(raw)
          → isPickResponse() validation
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
6. **PickResponse validation** — Type guards colocated with types; compile-time + runtime enforcement
7. **Transport/protocol separation** — `ipc.ts` (raw socket) + `client.ts` (protocol) are independent seams
8. **Path resolution as pure function** — `resolveSearchTarget()`: POJOs in, string out; tested without mocks
