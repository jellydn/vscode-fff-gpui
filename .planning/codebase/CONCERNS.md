# CONCERNS.md — Technical Concerns

## Known Issues (from AGENTS.md)

### 1. Socket path config not wired

`src/config.ts` defines `getSocketPath()` but `resolveSocketPath()` in `src/client.ts` only uses the default path. The config is read by `runPicker.ts` and passed to `sendCommand()`, which does use it. **Status**: Actually wired correctly — `runPicker.ts` calls `sendCommand(command, getSocketPath() || undefined, searchPath)`. The AGENTS.md note may be stale.

### 2. `${workspaceFolder}` is literal string expansion, not VS Code variable

`resolveSocketPath()` does a simple string `replaceAll` for `${workspaceFolder}` rather than using VS Code's native variable expansion. Users must write the literal string `${workspaceFolder}` in their `fff-gpui.socketPath` setting. This works correctly but is different from other VS Code settings that support `${workspaceFolder}` natively.

### 3. Test files excluded from `tsc --noEmit` typecheck

`tsconfig.json` includes `"test"` in the `include` array, so tests ARE typechecked. The AGENTS.md note about tests being excluded may be stale.

### 4. vitest 4.x requires vite as peer dependency

Vitest 4 requires `vite` 8.x as a peer dependency. Both are installed but this coupling means upgrading vitest requires checking vite compatibility.

### 5. `vsce package --no-dependencies`

The `--no-dependencies` flag is used because tsup bundles `reactive-vscode` via `noExternal`. Allowing vsce to also bundle it would cause a double-bundle. This is a workaround, not a bug.

## Potential Concerns

### 1. Daemon protocol is undocumented

The `ServiceCommand` and `PickResponse` schemas are reverse-engineered from the fff-gpui Rust source (`src/service.rs`). There's no public protocol documentation. Any breaking change to the daemon's JSON schema could break the extension silently.

**Mitigation**: `isPickResponse()` type guard rejects unexpected shapes and produces clear error messages. The truncated parse error also helps surface issues without leaking data.

### 2. Single socket path assumption

The extension assumes exactly one socket at `~/.local/state/fff-gpui/fff-gpui.sock`. If fff-gpui ever supports multiple daemon instances or changes its socket path, the extension would need updating.

**Mitigation**: The `fff-gpui.socketPath` config setting allows users to override the path. The `resolveSocketPath()` function supports tilde expansion, `$workspaceFolder`, and relative/absolute paths.

### 3. No socket reconnection

If the daemon restarts mid-session, the extension does not automatically reconnect. The user must retry the command. For a background daemon managed by `brew services`, this is unlikely but possible.

**Potential improvement**: Implement exponential backoff reconnection in `sendCommand()`.

### 4. macOS-only

fff-gpui itself is macOS-only (Apple Silicon and Intel). The extension inherits this limitation. No Linux or Windows fallback exists.

### 5. No progress indicator during daemon communication

The only UI feedback during `sendCommand()` is the status bar hint (`setStatusBarMessage`, 8s timeout). There's no spinner, progress bar, or "connecting..." message. For slow connections or large workspaces, this could feel unresponsive.

### 6. Error messages expose internal paths

Error messages include the resolved socket path and sometimes the search path. While not a security vulnerability (these are local paths), it could be noisy in error displays.

### 7. No daemon auto-start

The extension does not attempt to start the fff-gpui daemon if it's not running. It only shows an error with install instructions. Some extensions auto-start their companion daemon.

**Decision**: Explicit opt-in via `brew services start` matches Jellydn's philosophy of minimal side effects.

## Tech Debt Inventory

| Severity | Item                                               | Location           |
| -------- | -------------------------------------------------- | ------------------ |
| Low      | AGENTS.md "Known quirks" may contain stale entries | `AGENTS.md`        |
| Low      | vitest-vite peer dependency coupling               | `package.json`     |
| Medium   | Undocumented daemon protocol                       | `src/types.ts`     |
| Medium   | No socket reconnection                             | `src/ipc.ts`       |
| Low      | macOS-only (inherited from fff-gpui)               | All                |
| Low      | No progress indicator during IPC                   | `src/runPicker.ts` |

## Security Posture

The extension has security-conscious design:

- **Socket ownership verification**: `verifySocketSecurity()` checks that the socket is owned by the current user (UID match)
- **Socket permission verification**: Rejects world-writable sockets (mode check `& 0o002`)
- **Parse error truncation**: Full daemon payload logged to output channel, user-facing message truncated to 100 characters (Phase 7)
- **PickResponse validation**: Type guards reject malformed or unexpected responses before they reach file opening
- **No external network calls**: The extension only communicates with a local Unix socket
- **No arbitrary code execution**: Commands are hardcoded (file mode + grep mode), not configurable by workspace settings

## Future Improvements

1. **Socket reconnection** with exponential backoff
2. **Progress indicator** during daemon communication (e.g., `withProgress`)
3. **`query` field support** — pre-fill the daemon search bar with a pattern from VS Code (depends on th0jensen/fff-gpui#10)
4. **Cross-platform fallback** if fff-gpui adds Linux/Windows support
5. **Daemon auto-start** option (opt-in config setting)
