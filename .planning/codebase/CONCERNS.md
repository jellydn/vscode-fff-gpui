# Codebase Concerns

**Analysis Date:** 2026-06-23

## Tech Debt

**Socket Path Variable Resolution:**
- Issue: The custom socket path configuration `fff-gpui.socketPath` is read but not resolved/expanded. It does not expand `~` (home directory) or VS Code workspace variables like `${workspaceFolder}`, which will cause connection failures if users specify them.
- Files: `src/client.ts`, `src/config.ts`
- Impact: Users cannot use standard home-directory paths (e.g. `~/.config/...`) or relative paths in settings.
- Fix approach: Implement path expansion for socket paths (e.g., using `os.homedir()` to replace `~`) or validate and resolve paths before opening connection.

**Strict Workspace Directory Requirement:**
- Issue: The commands assume a workspace folder must be open and will fail with an error dialog if none is.
- Files: `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`
- Impact: Users cannot use the extension to find or grep files in a single-file mode or when no workspace folder is active.
- Fix approach: Gracefully handle cases without active workspace folders, perhaps defaulting to the current file's directory or prompting the user.

## Known Bugs

**Unresolved socketPath Configuration:**
- Symptoms: If `fff-gpui.socketPath` is set to a path containing `~` (e.g. `~/fff-gpui.sock`), the extension fails to connect and throws a daemon-not-running error.
- Files: `src/client.ts`, `src/config.ts`
- Trigger: Set `fff-gpui.socketPath` to `~/fff-gpui.sock` in settings and execute a find or grep command.
- Workaround: Set the absolute path (e.g. `/Users/username/fff-gpui.sock`) in configuration.

## Security Considerations

**Socket Path Injection/Spoofing:**
- Risk: Malicious local users or workspace configuration settings could point the socket path to a malicious UNIX socket, intercepting workspace search requests (containing path details).
- Files: `src/client.ts`
- Current mitigation: None. The extension connects to whatever path is supplied by `socketPathOverride` or defaults to user's home directory.
- Recommendations: Validate that the socket file is owned by the current user and lies within a secure directory (e.g., owned by user, restricted permissions).

## Performance Bottlenecks

**Sequential File Opening:**
- Problem: Opening multiple selected files happens sequentially.
- Files: `src/commands/openFiles.ts`
- Cause: Using `await` within a `for...of` loop when calling `vscode.window.showTextDocument`.
- Improvement path: Parallelize document loading with `Promise.all` for opening, then show them, or limit the number of active/focused documents to open.

## Fragile Areas

**Daemon Error Handling:**
- Files: `src/client.ts`
- Why fragile: Error handling assumes `ENOENT` or `ECONNREFUSED` always means the daemon is not running (and tells the user to install via `brew`). This message could be misleading if the daemon is running but on a different socket, or if permissions are incorrect.
- Safe modification: Check if the socket exists on disk before deciding to throw the "daemon not running" message, and improve error logging.
- Test coverage: Tested with mocked `net.createConnection` errors in `test/client.test.ts`.

## Scaling Limits

**Large Payload Serialization:**
- Current capacity: Unknown.
- Limit: Very large lists of file paths selected from the daemon could block the main thread during `JSON.parse` or when reading from the socket.
- Scaling path: Introduce streaming JSON parsing if large payloads become common, or implement pagination/limits in the daemon's communication protocol.

## Dependencies at Risk

**reactive-vscode:**
- Risk: Uses `reactive-vscode` (v0.3.0) which is a relatively new and fast-moving library.
- Impact: Future updates to VS Code or `reactive-vscode` could introduce breaking changes to the extension lifecycle commands.
- Migration plan: Standard VS Code extension API is stable and could be used directly with minimal boilerplate if `reactive-vscode` becomes unmaintained.

## Missing Critical Features

**Daemon Lifecycle Management:**
- Problem: The extension does not manage the lifecycle of the `fff-gpui` daemon. It expects the user to run it via brew services.
- Blocks: If the daemon crashes or isn't started, the extension is unusable until the user drops to a terminal to start it.

## Test Coverage Gaps

**Excluded Test Directory in tsconfig:**
- What's not tested: The tests themselves are not typechecked because `test/` is excluded from `tsconfig.json`.
- Files: `tsconfig.json`, `test/client.test.ts`
- Risk: Changes in types or source code might break test files silently without showing compilation/typecheck errors until Vitest is run.
- Priority: High

**Missing Integration and Commands Tests:**
- What's not tested: Command handlers (`findFiles.ts`, `grepFiles.ts`, `openFiles.ts`), config retrieval (`config.ts`), and activation logic (`extension.ts`) are not covered by any tests.
- Files: `src/commands/*`, `src/config.ts`, `src/extension.ts`
- Risk: Code changes in command invocation or configuration retrieval could break the extension without failing tests.
- Priority: Medium

---

*Concerns audit: 2026-06-23*
