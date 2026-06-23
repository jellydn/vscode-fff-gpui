# Architecture

**Analysis Date:** 2026-06-23

## Pattern Overview

**Overall:** IPC Daemon-Client Bridge Pattern / MVC with Command Controller Layer

**Key Characteristics:**
- **Decoupled User Interface:** Delegation of searching/grepping terminal user interface (TUI) to an external daemon running via UNIX socket.
- **Reactive Hooks Lifecycle:** Utilizes `reactive-vscode` for extension lifecycle orchestration and clean event-driven resource disposals.
- **Promise-Wrapped Socket Client:** Translates stream-oriented asynchronous Node socket events into flat Promise responses (`Promise<PickResponse>`).

## Layers

**Extension Host (Entry Point):**
- Purpose: Integrates with VS Code, registers command lifecycle, and sets up loggers.
- Location: `src/extension.ts`
- Contains: Extension lifecycle activation/deactivation exports and event listener bindings.
- Depends on: `reactive-vscode`, `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`, `src/logger.ts`
- Used by: VS Code Extension Host Process

**Command / Controller:**
- Purpose: Orchestrates command-specific flows, retrieves workspace settings, coordinates socket calls, and opens documents.
- Location: `src/commands/`
- Contains: `findFiles.ts`, `grepFiles.ts`, `openFiles.ts`
- Depends on: `src/client.ts`, `src/config.ts`, `src/types.ts`
- Used by: `src/extension.ts`

**IPC / Socket Client:**
- Purpose: Handles connection lifecycle to the UNIX socket and data translation.
- Location: `src/client.ts`
- Contains: Client implementation to write JSON commands and wait for files payload response.
- Depends on: `node:net`, `node:os`, `node:path`, `src/types.ts`
- Used by: `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`

**Configuration:**
- Purpose: Standard workspace configuration accessors.
- Location: `src/config.ts`
- Contains: Helper functions for reading workspace settings.
- Depends on: `vscode`
- Used by: `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`

## Data Flow

**TUI Picker Flow:**
1. User invokes a VS Code command via keyboard shortcuts (`cmd+k cmd+p` or `cmd+k cmd+f`).
2. Command controller gets the local Workspace Root path and calls `sendCommand()` with the appropriate daemon instructions (e.g. `in_grep: true/false`).
3. Socket Client connects to UNIX Socket (`~/.local/state/fff-gpui/fff-gpui.sock`) and writes JSON instruction (`{"cmd":"open_path","path":"/path/to/project","in_grep":false}\n`).
4. External Daemon wakes up the TUI picker on the local user terminal. User picks the target files.
5. External Daemon writes JSON payload selection (`{"paths":[{"path":"/foo/bar.ts","line":12,"column":5}]}`) back to socket, closing connection.
6. Socket Client handles socket stream end, parses payload, resolves `PickResponse`.
7. Command controller maps 1-indexed coordinates to 0-indexed positions, opens text document, positions selection cursor, and highlights editor tab.

**State Management:**
- Stateless: The extension maintains no persistent states in memory. The daemon maintains UI and active selections, and state configurations are fetched reactively from VS Code workspace storage.

## Key Abstractions

**PickResponse & PickEntry:**
- Purpose: Defines standard response schema expected from daemon IPC protocol.
- Examples: `src/types.ts`
- Pattern: Data Transfer Object (DTO)

**ServiceCommand:**
- Purpose: Declares supported commands that can be sent to daemon.
- Examples: `src/types.ts`
- Pattern: Command Pattern Envelope

## Entry Points

**Extension Entry Point:**
- Location: `src/extension.ts`
- Triggers: VS Code Extension Activation Lifecycle events.
- Responsibilities: Runs setup, commands registration, and cleanup disposers on deactivation.

**Keybindings Command Handlers:**
- Location: `src/commands/findFiles.ts` and `src/commands/grepFiles.ts`
- Triggers: VS Code command pallet hooks or key combinations (`cmd+k cmd+p` / `cmd+k cmd+f`).
- Responsibilities: Prepares path and triggers IPC query.

## Error Handling

**Strategy:** Fail-Safe with UI Notifications

**Patterns:**
- **Specific Daemon Fault Detection:** Catching `ENOENT` or `ECONNREFUSED` socket faults and prompting the user to install/run the background service via Brew.
- **Timeout Protection:** Employs a 60-second connection timeout that halts socket blockages and releases active connections.
- **Safe Index Mapping:** Clamps picked coordinates to `Math.max(0, ...)` during 1-indexed to 0-indexed mapping to avoid out-of-bounds positions in the editor.

## Cross-Cutting Concerns

**Logging:** Uses output channel wrapper (`src/logger.ts`) writing formatted ISO strings into the 'fff-gpui' output pane.

**Validation:** Asserts active workspace availability before execution to prevent null reference errors on workspace paths.

**Authentication:** Inherits OS socket access rights of the current active session user.

---

*Architecture analysis: 2026-06-23*
