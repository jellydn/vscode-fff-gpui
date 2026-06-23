# INTEGRATIONS.md — External Integrations

## fff-gpui Daemon

The only external runtime dependency. The extension communicates with the fff-gpui native picker daemon via Unix socket IPC.

- **Protocol**: JSON line protocol over a Unix socket
- **Default socket**: `~/.local/state/fff-gpui/fff-gpui.sock`
- **Command format**: `ServiceCommand` — `{ cmd: "open_path", path: string, in_grep?: boolean }`
- **Response format**: `PickResponse` — `{ paths: PickEntry[] }` where each `PickEntry` has `{ path: string, line?: number, column?: number }`
- **Timeout**: 60 seconds (`socket.setTimeout(60_000)` in `src/client.ts`)
- **Security**: Socket ownership (UID match) and permission (no world-writable) verification in `src/client.ts:verifySocketSecurity()`

### Connection Flow

1. Resolve socket path (`src/client.ts:resolveSocketPath()`) — supports `~`, `${workspaceFolder}`, relative, and absolute paths
2. Verify socket security (`src/client.ts:verifySocketSecurity()`) — checks owner and permissions
3. Connect via `net.createConnection(socketPath)`
4. Write `JSON.stringify(command) + "\n"`
5. Read response chunks, parse JSON on socket `end`
6. Validate response via `isPickResponse()` type guard
7. Return validated `PickResponse`

### Error Handling

- `ENOENT` → socket file missing
- `ECONNREFUSED` → socket file exists but daemon not listening
- Socket timeout → 60s timeout with clear message
- Invalid JSON → truncated error message (full payload logged to output channel)
- Invalid shape → "invalid response (expected { paths: PickEntry[] })" error

## Marketplaces

### VS Code Marketplace

- **Publisher**: `jellydn`
- **Extension ID**: `jellydn.vscode-fff-gpui`
- **Auth**: Azure DevOps PAT (scope: Marketplace → Manage)
- **Publish**: `HaaLeo/publish-vscode-extension@v2` GitHub Action

### Open VSX Registry

- **Extension ID**: `jellydn/vscode-fff-gpui`
- **Auth**: Open VSX personal access token
- **Publish**: Same GitHub Action, separate step

## GitHub

- **Repository**: `github.com/jellydn/vscode-fff-gpui`
- **Actions**: `ci.yml` (PR checks), `publish.yml` (release pipeline)
- **Version bump**: Manual — only publishes when `package.json` version differs from previous commit

## No External APIs or Services

The extension is self-contained. It does not call any cloud APIs, databases, or external HTTP services. All functionality runs through the local fff-gpui daemon socket.
