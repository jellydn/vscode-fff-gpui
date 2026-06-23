# External Integrations

**Analysis Date:** 2026-06-23

## APIs & External Services

**Native daemon over Unix socket:**

- `fff-gpui` daemon - Main external integration; `src/client.ts` connects to `~/.local/state/fff-gpui/fff-gpui.sock` by default, writes one newline-delimited JSON command, waits for the daemon response, and parses selected paths.
- SDK/Client: Node `net` socket client - `src/client.ts` uses `net.createConnection(socketPath)`, `socket.write()`, `data`, `end`, `error`, and `timeout` events rather than an HTTP SDK.
- Auth: local filesystem ownership/permissions - `src/client.ts` verifies the path is a socket, is not world-writable, and is owned by the current UID when UID data is available; there is no token or remote authentication.
- Protocol request: `ServiceCommand` - `src/types.ts` defines `cmd` values `open_path`, `open_one_shot`, `open_config`, `toggle_window`, and `quit`, with optional `path` and `in_grep` fields; `src/commands/findFiles.ts` and `src/commands/grepFiles.ts` currently send `cmd: 'open_path'`.
- Protocol response: `PickResponse` - `src/types.ts` defines `paths: PickEntry[]`, and `src/client.ts` parses JSON into that shape before `src/commands/openFiles.ts` opens each selected file.

**VS Code Extension Host APIs:**

- VS Code command registry - Commands are contributed in `package.json` and registered at runtime through `useCommand()` in `src/extension.ts`.
- SDK/Client: VS Code API import `vscode` - Used in `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`, `src/commands/openFiles.ts`, `src/commands/runCustomTask.ts`, `src/config.ts`, and `src/logger.ts`.
- Auth: VS Code local extension permissions - There is no OAuth/API-key flow in `package.json` or `src/`; all VS Code API access is through the local extension host.

**Local shell/terminal:**

- Custom user tasks - `src/commands/runCustomTask.ts` reads `fff-gpui.customTasks`, presents a VS Code Quick Pick, creates a terminal named `fff-gpui: <label>`, and sends the configured shell command text.
- SDK/Client: VS Code terminal API - `src/commands/runCustomTask.ts` uses `vscode.window.createTerminal()`, `terminal.show()`, and `terminal.sendText()`.
- Auth: none in code - Commands are user-configured in VS Code settings declared by `package.json`; no secret handling or credential validation is implemented in `src/commands/runCustomTask.ts`.

## Data Storage

**Databases:**

- None - `package.json` has no database client dependencies, and `src/` only uses VS Code APIs plus Node filesystem/socket modules.
- Connection: not applicable - No database connection string or environment variable appears in `package.json`, `tsconfig.json`, `tsup.config.ts`, `biome.json`, `vitest.config.ts`, or `src/`.
- Client: none - No ORM or database client is imported anywhere under `src/`.

**File Storage:**

- Local filesystem only - `src/client.ts` uses `fs.statSync()` and `fs.existsSync()` to inspect the daemon socket path, and `src/commands/openFiles.ts` opens local selected paths via `vscode.Uri.file(entry.path)`.
- VS Code settings storage - `package.json` declares `fff-gpui.socketPath` and `fff-gpui.customTasks`; `src/config.ts` and `src/commands/runCustomTask.ts` read those settings through `vscode.workspace.getConfiguration()`.

**Caching:**

- In-memory last-search cache only - `src/commands/resumeSearch.ts` stores `lastSearch` in a module-level variable and loses it when the extension host reloads or the extension deactivates.
- No external cache - `package.json` contains no Redis/Memcached/cache dependency, and `src/commands/resumeSearch.ts` does not persist `lastSearch` to disk or VS Code global state.

## Authentication & Identity

**Auth Provider:**

- None - `package.json` defines no auth-related dependencies or configuration, and no file under `src/` implements OAuth, tokens, sessions, or user login.
- Implementation: local trust boundary - `src/client.ts` relies on Unix socket file ownership/permissions and current OS user identity from `os.userInfo()` before connecting to the native daemon.
- VS Code user context - `src/commands/openFiles.ts`, `src/commands/runCustomTask.ts`, `src/config.ts`, and `src/logger.ts` run inside the current local VS Code extension host without a separate app identity layer.

## Monitoring & Observability

**Error Tracking:**

- None - `package.json` has no Sentry/OpenTelemetry/error-reporting dependency, and `src/` sends errors only to local VS Code UI or console.
- User-facing daemon errors - `src/client.ts` converts `ENOENT` and `ECONNREFUSED` into an install/start message, while `src/commands/findFiles.ts` and `src/commands/grepFiles.ts` display caught errors with `vscode.window.showErrorMessage()`.

**Logs:**

- VS Code output channel - `src/logger.ts` creates an output channel named `fff-gpui`, appends timestamped log lines, and disposes the channel on deactivation from `src/extension.ts`.
- Console warnings for partial open failures - `src/commands/openFiles.ts` uses `console.warn()` when `showTextDocument()` rejects for an individual file after `Promise.allSettled()`.
- Status bar tips - `src/commands/findFiles.ts` and `src/commands/grepFiles.ts` use `vscode.window.setStatusBarMessage()` to show short usage hints before invoking the daemon.

## CI/CD & Deployment

**Hosting:**

- VS Code Marketplace packaging target - `package.json` declares extension metadata, `main: './dist/extension.js'`, and scripts `package` plus `publish` using `vsce`.
- Open VSX tooling present but not wired - `package.json` lists `ovsx` in `devDependencies`, but no script in `package.json` invokes it.
- Native daemon distribution out of scope - `AGENTS.md` says users install `fff-gpui` separately via Homebrew; this VS Code extension does not vendor or start the daemon in `src/`.

**CI Pipeline:**

- None visible in requested files - `package.json` provides local scripts `lint`, `typecheck`, `test`, `build`, `package`, and `publish`, but no CI service configuration was present in the requested files or under `src/`.
- Recommended local validation order - `AGENTS.md` states the order `lint && typecheck && test && build` for this project.

## Environment Configuration

**Required env vars:**

- None required by extension code - No `process.env` usage appears in `src/`, and `package.json` declares configuration through VS Code settings instead of environment variables.
- `$HOME`/home directory implied - `src/client.ts`, `src/commands/findFiles.ts`, and `src/commands/grepFiles.ts` use `os.homedir()` to resolve the default socket path and fallback search path.

**Secrets location:**

- No secrets - `package.json` and all files under `src/` contain no API keys, secret names, token settings, or credential storage paths.
- User settings may contain shell commands, not secrets by design - `package.json` declares `fff-gpui.customTasks`, and `src/commands/runCustomTask.ts` executes selected configured command text in a terminal.

## Webhooks & Callbacks

**Incoming:**

- None - This is a VS Code extension with command activation events in `package.json`; no HTTP server, webhook route, or callback listener appears in `src/`.
- Socket responses from daemon only - `src/client.ts` listens for data/end events from the already-connected Unix socket after initiating a local client connection.

**Outgoing:**

- Unix socket command to `fff-gpui` daemon - `src/client.ts` sends JSON plus newline to the daemon socket for each `sendCommand()` invocation.
- VS Code UI actions - `src/commands/openFiles.ts` opens selected files and positions selections, `src/commands/runCustomTask.ts` sends shell text to a terminal, and `src/logger.ts` writes to a local output channel.
- No network HTTP callbacks - No file under `src/` imports HTTP/fetch libraries, and `package.json` contains no HTTP client dependency.

---

_Integration audit: 2026-06-23_
