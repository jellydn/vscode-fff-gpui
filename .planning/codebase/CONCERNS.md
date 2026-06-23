# Codebase Concerns

**Analysis Date:** 2026-06-23

## Tech Debt

**Command wrappers duplicate search-root and daemon-call logic:**

- Issue: `findFiles()` and `grepFiles()` carry nearly identical fallback path resolution, status-bar messaging, `sendCommand()` invocation, config lookup, and error-display code; only `in_grep` and the tip text differ.
- Files: `src/commands/findFiles.ts:8-36`, `src/commands/grepFiles.ts:8-36`
- Impact: Behavior can drift between file and grep commands, and future changes to workspace fallback, socket config, logging, or error presentation must be made twice.
- Fix approach: Extract a shared helper that accepts `{ inGrep, statusTip, searchKind }` or a small `runPickerCommand()` function, then keep the command modules as thin wrappers.

**Manifest advertises specialized commands that currently reuse generic picker modes:**

- Issue: `fff-gpui.pickFileFromGitStatus` and `fff-gpui.findTodoFixme` are registered as distinct commands, but they only call `findFiles()`/`grepFiles()` with normal picker payloads; no initial `git:modified`, `TODO`, or `FIXME` query is sent to the daemon.
- Files: `src/extension.ts:23-33`, `src/commands/findFiles.ts:24-32`, `src/commands/grepFiles.ts:24-32`, `package.json:35-47`, `README.md:48-56`
- Impact: Command titles promise narrower workflows, but users still have to type the filter manually. This is a product/UX debt and could become a bug if callers expect these commands to pre-seed search state.
- Fix approach: Extend `ServiceCommand` and daemon integration if the native protocol supports an initial query/filter, or rename the commands/docs to make the manual step explicit.

**Resume search only remembers the command kind, not the actual search state:**

- Issue: `saveSearch()` stores only `{ kind }`; `resumeSearch()` re-runs the broad file or grep command instead of restoring the prior query, selected mode, workspace, or results.
- Files: `src/commands/resumeSearch.ts:4-18`, `src/commands/resumeSearch.ts:21-49`, `src/extension.ts:11-37`
- Impact: The command name “Resume Last Search” is stronger than the implementation. It cannot resume the last typed query or grep state after the daemon window closes.
- Fix approach: Either rename the feature to “Repeat Last Picker Mode” or add protocol support for persisting/restoring daemon-side search state.

**Documented quirks in `AGENTS.md` are stale and contradict the current code:**

- Issue: The repository guidance says `resolveSocketPath()` ignores `fff-gpui.socketPath`, tests are excluded from `tsconfig.json`, and commands require an open workspace. Current code shows the socket path is read via `getSocketPath()` and passed to `sendCommand()`, `tsconfig.json` includes `test`, and commands fall back to the active editor directory or home directory.
- Files: `AGENTS.md:51-53`, `src/config.ts:3-5`, `src/commands/findFiles.ts:9-16`, `src/commands/grepFiles.ts:9-16`, `tsconfig.json:17-18`, `test/commands.test.ts:183-205`, `test/client.test.ts:165-170`
- Impact: Future agents or maintainers may waste time fixing already-resolved issues, or may make changes based on inaccurate assumptions about runtime behavior.
- Fix approach: Update `AGENTS.md` to mark these quirks as resolved or replace them with the current limitations found in this audit.

## Known Bugs

**README fallback behavior is accurate now, but project guidance still says no-workspace commands error:**

- Symptoms: There is no current no-workspace error path in `findFiles()`/`grepFiles()`; both commands fall back to the active file directory and then `os.homedir()`. The stale guidance is the bug in project documentation, not command behavior.
- Files: `AGENTS.md:53`, `README.md:58`, `src/commands/findFiles.ts:9-16`, `src/commands/grepFiles.ts:9-16`, `test/commands.test.ts:126-166`, `test/commands.test.ts:285-309`
- Trigger: Read `AGENTS.md` before modifying command behavior, then compare it to the current command implementation or run the no-workspace tests.
- Workaround: Trust the source/tests over `AGENTS.md` until the guidance file is corrected.

**Partial document-load failure aborts opening all selected files:**

- Symptoms: `openFiles()` loads every selected document with `Promise.all`; if one path cannot be opened, the whole function rejects before any `showTextDocument()` calls run. The test suite explicitly asserts this rejection.
- Files: `src/commands/openFiles.ts:9-12`, `test/commands.test.ts:441-449`
- Trigger: Select multiple files where at least one path no longer exists, is inaccessible, or is not a local file VS Code can open.
- Workaround: Re-run the picker and select only accessible files. A code fix would use `Promise.allSettled()` for document loading, then show successfully loaded documents and surface failures.

**Daemon response shape is not validated after JSON parsing:**

- Symptoms: `sendCommand()` casts `JSON.parse(trimmed)` to `PickResponse` and resolves it without checking that `paths` is an array of entries with string `path` fields.
- Files: `src/client.ts:89-91`, `src/types.ts:7-14`, `src/commands/openFiles.ts:4-12`
- Trigger: The daemon returns syntactically valid JSON with a wrong shape, such as `{}`, `{ "paths": null }`, or entries without `path`.
- Workaround: None in the extension. Add runtime validation before resolving, and return a user-facing daemon protocol error for malformed responses.

**Custom socket path config is wired, so the documented hardcoded-socket quirk is resolved:**

- Symptoms: `getSocketPath()` reads `fff-gpui.socketPath`; both picker commands pass it to `sendCommand()`; `sendCommand()` falls back to the default only when no override is provided. Tests cover the override path.
- Files: `src/config.ts:3-5`, `src/commands/findFiles.ts:30-31`, `src/commands/grepFiles.ts:30-31`, `src/client.ts:57-63`, `test/commands.test.ts:183-205`, `test/client.test.ts:165-170`, `AGENTS.md:51`
- Trigger: Set `fff-gpui.socketPath` to a non-empty value and invoke find or grep.
- Workaround: No workaround needed for current code; update `AGENTS.md` to remove the stale quirk.

## Security Considerations

**User-configured custom tasks execute arbitrary shell text:**

- Risk: Any value in `fff-gpui.customTasks[].command` is sent directly to a VS Code terminal via `terminal.sendText()`, which executes the command as the user when `addNewLine` defaults to true.
- Files: `src/commands/runCustomTask.ts:8-10`, `src/commands/runCustomTask.ts:21-32`, `package.json:92-111`, `test/runCustomTask.test.ts:46-60`
- Current mitigation: Tasks must be configured in the user/workspace VS Code settings and selected through QuickPick; there is no sanitization, trust check, confirmation, workspace-trust gate, or allowlist.
- Recommendations: Treat workspace-provided custom tasks as privileged. Consider checking VS Code Workspace Trust, showing the command in a confirmation prompt, documenting the risk, and rejecting malformed task objects.

**Unix socket security checks are helpful but still have a time-of-check/time-of-use window:**

- Risk: `verifySocketSecurity()` checks ownership, type, and world-writable mode before `net.createConnection()`, but the socket path can be swapped between `fs.statSync()` and connect.
- Files: `src/client.ts:28-55`, `src/client.ts:64-72`, `test/client.test.ts:250-296`
- Current mitigation: The code rejects non-socket paths, sockets owned by a different UID, and world-writable socket files when the path exists.
- Recommendations: Keep the check, but do not treat it as a complete authentication boundary. Prefer sockets under user-private directories, document that custom paths should not be in shared writable directories, and consider checking parent directory permissions for custom socket paths.

**Daemon controls which local paths VS Code opens:**

- Risk: The extension opens every `entry.path` returned by the daemon with `vscode.Uri.file()`. A compromised or malicious daemon could cause VS Code to open arbitrary local files readable by the user.
- Files: `src/client.ts:89-91`, `src/commands/openFiles.ts:9-12`, `src/types.ts:7-10`
- Current mitigation: Socket ownership/world-writable checks reduce accidental connection to another user’s daemon, but there is no path scoping against `searchPath`.
- Recommendations: Decide whether results should be constrained to the requested workspace/search root. If yes, validate returned paths with `path.resolve()` and reject or warn on paths outside the root.

**Error messages can expose daemon response content:**

- Risk: Invalid JSON parse failures include the full trimmed daemon response in the thrown error, which is later shown to the user through `showErrorMessage()` and may reveal unexpected local paths or daemon output.
- Files: `src/client.ts:89-94`, `src/commands/findFiles.ts:34-36`, `src/commands/grepFiles.ts:34-36`, `test/client.test.ts:131-148`
- Current mitigation: None beyond only showing this to the local user.
- Recommendations: Truncate parse-error payloads and send full raw responses only to the output channel when needed for debugging.

## Performance Bottlenecks

**Opening many selected files is unbounded:**

- Problem: `openFiles()` loads all documents in parallel and then attempts to show all documents in parallel with no concurrency limit or maximum selection guard.
- Files: `src/commands/openFiles.ts:9-17`, `test/commands.test.ts:359-382`, `test/commands.test.ts:479-509`
- Cause: `Promise.all()` and `Promise.allSettled()` are applied directly to the full daemon result set.
- Improvement path: Cap multi-select count, add a confirmation for large selections, or process document opens with a small concurrency limit.

**The 60-second socket timeout may leave users waiting with little feedback:**

- Problem: A hung daemon or picker session keeps the command promise pending for up to 60 seconds, with only a transient status-bar tip before a timeout error.
- Files: `src/client.ts:111-115`, `src/commands/findFiles.ts:19-35`, `src/commands/grepFiles.ts:19-35`, `test/client.test.ts:150-163`
- Cause: The timeout is hardcoded in `sendCommand()` and is not configurable or cancellable from VS Code UI.
- Improvement path: Consider a shorter connection timeout plus a separate user-selection timeout, expose a setting, or use `window.withProgress()`/cancellation for long waits.

**Large daemon responses are accumulated as one string and parsed at end:**

- Problem: All socket chunks are appended to `data` and parsed only after `end`; there is no size limit, streaming decode, or newline-delimited frame handling beyond sending a newline to the daemon.
- Files: `src/client.ts:72-94`
- Cause: The client assumes one complete JSON document per connection and stores it entirely in memory.
- Improvement path: Enforce a maximum response size, parse a single newline-delimited frame if that is the daemon protocol, and reject oversized or multi-frame responses clearly.

## Fragile Areas

**Socket protocol boundary:**

- Files: `src/client.ts:57-117`, `src/types.ts:1-14`, `test/client.test.ts:30-209`
- Why fragile: The code assumes the daemon sends exactly one JSON object then ends the socket. Valid JSON with the wrong schema is accepted; multiple JSON messages or daemon logs mixed into stdout will fail parsing.
- Safe modification: Add explicit protocol framing and runtime validation tests before changing command fields or response handling.
- Test coverage: Good coverage for connect/write, empty response, valid JSON, invalid JSON, daemon missing, refused connection, and timeout; missing coverage for malformed-but-valid JSON shape, multi-message responses, large responses, and socket close without `end` semantics.

**Search-root fallback and workspace semantics:**

- Files: `src/commands/findFiles.ts:9-16`, `src/commands/grepFiles.ts:9-16`, `README.md:58`, `test/commands.test.ts:113-166`, `test/commands.test.ts:272-309`
- Why fragile: Both commands duplicate the same first-workspace/active-editor/home fallback logic, and multi-root workspaces always use `workspaceFolders[0]` rather than the active file’s workspace folder.
- Safe modification: Centralize search-root resolution and add tests for multi-root workspaces and active editors outside the first workspace.
- Test coverage: Covers first workspace, active file fallback, home fallback, and non-file active editor for `findFiles`; `grepFiles` lacks the non-file active editor case and multi-root cases.

**Opening selected files:**

- Files: `src/commands/openFiles.ts:4-40`, `test/commands.test.ts:338-510`
- Why fragile: A document-load failure rejects the whole operation, but a show failure is only logged to `console.warn`; users receive no VS Code notification for partial failures.
- Safe modification: Use `Promise.allSettled()` for both load and show stages, preserve successful opens, and report a concise failure count through `showWarningMessage()` or the output channel.
- Test coverage: Covers empty entries, parallel loading, preview behavior, line/column conversion, show failures, and load failure rejection; missing tests for invalid paths, out-of-range line/column relative to document length, and user-visible warning behavior.

**Extension command registration versus package manifest:**

- Files: `src/extension.ts:11-43`, `package.json:22-48`, `package.json:52-83`
- Why fragile: Commands are declared in two places. If a command is added or renamed in the manifest but not registered in `extension.ts`, activation can occur without a handler.
- Safe modification: When adding commands, update manifest, keybindings, and `useCommand()` registrations together; add a test or static check that manifest commands are registered.
- Test coverage: No test imports `src/extension.ts` to verify command registration or manifest/implementation parity.

## Scaling Limits

**Single search root per invocation:**

- Current capacity: One `path` string is sent in each `open_path` command.
- Limit: Multi-root VS Code workspaces are not searched as a set; the current implementation always picks the first workspace folder unless no workspace exists.
- Scaling path: Add workspace selection, use the active editor’s workspace folder, or extend the daemon protocol to accept multiple roots.

**Single daemon socket connection per command invocation:**

- Current capacity: One Unix socket connection per command, with one JSON request and one JSON response.
- Limit: Concurrent command invocations can open multiple socket connections and race UI state in the external daemon; there is no in-extension queue or “picker already open” guard.
- Scaling path: Serialize picker invocations or track an in-flight command promise so repeated key presses do not launch overlapping daemon interactions.

**Unbounded result and selection size:**

- Current capacity: The extension accepts whatever number of paths the daemon returns.
- Limit: A large multi-select can attempt to open many documents/tabs at once, consuming memory and making VS Code unresponsive.
- Scaling path: Add a configurable maximum open count or prompt before opening large selections.

## Dependencies at Risk

**`reactive-vscode`:**

- Risk: The extension lifecycle and command registration depend on `reactive-vscode` `^0.4.0`, which is a small abstraction over the VS Code API and is bundled into the extension (`tsup.config.ts` marks it `noExternal`).
- Impact: Breaking changes or maintenance issues in this dependency affect activation and command registration.
- Migration plan: Keep command handlers simple so they can be moved to native `vscode.ExtensionContext.subscriptions.push(vscode.commands.registerCommand(...))` if needed.

**VS Code engine floor `^1.85.0`:**

- Risk: The extension targets an older VS Code baseline while using modern TypeScript and Node APIs in the bundled extension.
- Impact: Runtime compatibility depends on VS Code’s extension host Node version for 1.85 and later; APIs like `String.prototype.replaceAll()` are safe for modern Node but should remain part of compatibility checks.
- Migration plan: Keep `target: es2022` aligned with the VS Code engine, and run extension smoke tests on the minimum supported VS Code version before publishing.

**External `fff-gpui` daemon protocol:**

- Risk: The most important runtime dependency is not an npm package; it is the native daemon, its socket location, and its JSON protocol.
- Impact: Daemon install, service state, protocol changes, or macOS-only availability can break all core extension commands.
- Migration plan: Version/document the expected daemon protocol, keep daemon-missing errors actionable, and add integration tests or manual release checks against supported daemon versions.

## Missing Critical Features

**No output-channel logging for command failures or daemon diagnostics:**

- Problem: A logger exists, but command failures are shown only as error popups and partial `showTextDocument()` failures go to `console.warn`.
- Blocks: Users following README troubleshooting guidance to check the `fff-gpui` output panel may not see socket errors, parse failures, selected search roots, or failed file opens there.

**No workspace trust handling for custom tasks:**

- Problem: Workspace settings can define shell commands, and the extension runs the selected command in a terminal without checking whether the workspace is trusted.
- Blocks: Safer use in untrusted repositories or shared workspaces where settings may be supplied by someone else.

**No runtime validation of settings objects:**

- Problem: `customTasks` is cast from configuration and used as if every item has string `label` and `command` fields.
- Blocks: Robust handling of malformed settings; bad values can produce confusing QuickPick entries or terminal names.

**No explicit daemon protocol version or capability negotiation:**

- Problem: The client sends `{ cmd, path, in_grep }` and assumes a `{ paths }` response without negotiating supported fields or commands.
- Blocks: Safely adding initial query support for git-status/TODO commands, richer grep metadata, or future daemon behavior changes.

## Test Coverage Gaps

**Extension activation and command registration:**

- What's not tested: `defineExtension()` setup, `useCommand()` registrations, deactivate cleanup, and parity between `package.json` contributed commands and implemented handlers.
- Files: `src/extension.ts:8-49`, `package.json:22-48`
- Risk: Manifest commands could activate the extension but fail at runtime because a handler is missing or renamed.
- Priority: Medium

**Resume command execution path:**

- What's not tested: `resumeSearch()` dynamically importing and invoking `findFiles()`/`grepFiles()` for each saved kind, and behavior when there is no prior search. Current tests cover only save/get state.
- Files: `src/commands/resumeSearch.ts:21-49`, `test/resumeSearch.test.ts:39-56`
- Risk: Resume can silently stop working while tests still pass.
- Priority: Medium

**Malformed but valid daemon responses:**

- What's not tested: Valid JSON that does not match `PickResponse`, entries with missing/non-string paths, negative or non-integer line/column values, and very large responses.
- Files: `src/client.ts:89-91`, `src/types.ts:7-14`, `test/client.test.ts:74-97`, `test/client.test.ts:131-148`
- Risk: Bad daemon output can surface later as confusing VS Code file-open errors or uncaught exceptions.
- Priority: High

**Socket lifecycle edge cases:**

- What's not tested: `close` without `end`, errors after a successful resolve/reject, partial data followed by timeout, multiple `data` frames containing multiple JSON objects, and `socket.write()` failure/backpressure.
- Files: `src/client.ts:70-116`, `test/client.test.ts:30-209`
- Risk: The promise may reject/resolve unpredictably or hang in less common socket failure modes.
- Priority: Medium

**Custom task validation and workspace trust:**

- What's not tested: Malformed custom task entries, duplicate labels, cancellation after a task list with invalid items, workspace-trust behavior, and user confirmation for dangerous commands.
- Files: `src/commands/runCustomTask.ts:3-32`, `test/runCustomTask.test.ts:29-74`
- Risk: Settings mistakes or untrusted workspace settings can execute unintended shell text.
- Priority: High

**Multi-root workspace behavior:**

- What's not tested: Choosing the active editor’s workspace folder in multi-root projects, active editors outside `workspaceFolders[0]`, or prompting users to choose a root.
- Files: `src/commands/findFiles.ts:9`, `src/commands/grepFiles.ts:9`, `test/commands.test.ts:113-166`, `test/commands.test.ts:272-309`
- Risk: Users in multi-root workspaces search the wrong project without a clear indication.
- Priority: Medium

**Typecheck coverage quirk is resolved, but tests still rely heavily on `any`:**

- What's not tested: The old `AGENTS.md` claim that `test/` is excluded from TypeScript is false; `tsconfig.json` includes both `src` and `test`. However, test mocks use broad `any` casts, so typecheck coverage does not fully validate mock contracts.
- Files: `AGENTS.md:52`, `tsconfig.json:17-18`, `test/client.test.ts:11`, `test/client.test.ts:40`, `test/client.test.ts:50`, `test/commands.test.ts:408-417`
- Risk: Mock shapes can drift from real VS Code or Node APIs while `tsc --noEmit` still passes.
- Priority: Low

---

_Concerns audit: 2026-06-23_
