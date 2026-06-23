# Technology Stack

**Analysis Date:** 2026-06-23

## Languages

**Primary:**

- TypeScript 5.5+ - Extension source, daemon client, command handlers, and typed protocol definitions live under `src/`, with compiler settings declared in `tsconfig.json` and dependency version `^5.5.0` in `package.json`.

**Secondary:**

- JSON - VS Code extension manifest, contribution points, scripts, settings schema, and tool configuration are in `package.json`, `tsconfig.json`, and `biome.json`.
- JavaScript/CommonJS output - `tsup.config.ts` bundles `src/extension.ts` to CommonJS at `dist/extension.js`, which is the VS Code extension entrypoint declared by `package.json`.
- Shell - Release/package automation is exposed through `scripts/release.sh` via `release` and `release:dry` scripts in `package.json`.

## Runtime

**Environment:**

- VS Code Extension Host targeting VS Code `^1.85.0` - Declared in `package.json` under `engines.vscode`; runtime API usage appears throughout `src/extension.ts`, `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`, `src/commands/openFiles.ts`, `src/commands/runCustomTask.ts`, `src/config.ts`, and `src/logger.ts`.
- Node.js extension runtime with ES2022 APIs - `tsconfig.json` targets `ES2022`, `tsup.config.ts` targets `es2022` on `platform: 'node'`, and `src/client.ts` uses Node built-ins `node:fs`, `node:net`, `node:os`, and `node:path`.

**Package Manager:**

- pnpm 11.8.0 - Declared as `packageManager` in `package.json`.
- Lockfile: present - `pnpm-lock.yaml` exists at the repository root.

## Frameworks

**Core:**

- reactive-vscode `^0.4.0` - Used to define the extension lifecycle and register commands through `defineExtension` and `useCommand` in `src/extension.ts`; bundled into the extension because `tsup.config.ts` lists it in `noExternal`.
- VS Code API `@types/vscode` `^1.85.0` - Used for workspace inspection, settings, status/error messages, document opening, selections, output channels, Quick Pick, and terminals in `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`, `src/commands/openFiles.ts`, `src/commands/runCustomTask.ts`, `src/config.ts`, and `src/logger.ts`.

**Testing:**

- Vitest `^2.0.0` - Configured for Node tests in `vitest.config.ts` with test file include pattern `test/**/*.test.ts`; the project instructions in `AGENTS.md` identify `test/client.test.ts` as the socket-client test suite.

**Build/Dev:**

- tsup `^8.0.0` - Bundles `src/extension.ts` to CommonJS with source maps, no minification, and no type declarations according to `tsup.config.ts`; invoked by `build` and `dev` scripts in `package.json`.
- TypeScript compiler `^5.5.0` - Runs `tsc --noEmit` through the `typecheck` script in `package.json`, with strict compiler options in `tsconfig.json`.
- Biome `^1.9.0` - Provides formatting, import organisation, and linting for `src/**/*.ts`, `test/**/*.ts`, `tsup.config.ts`, and `vitest.config.ts` as configured in `biome.json`.
- @vscode/vsce `^3.9.2` - Packages and publishes the VS Code extension via `package` and `publish` scripts in `package.json`.
- bumpp `^9.0.0` - Version bump utility exposed by the `bump` script in `package.json`.
- ovsx `^1.0.1` - Open VSX publishing tool listed in `package.json`, though no script currently invokes it in `package.json`.

## Key Dependencies

**Critical:**

- `reactive-vscode` `^0.4.0` - Required for activation/deactivation and command registration in `src/extension.ts`.
- `vscode` extension API external - Marked external in `tsup.config.ts` and used as the host API in `src/commands/openFiles.ts`, `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`, `src/commands/runCustomTask.ts`, `src/config.ts`, and `src/logger.ts`.
- Node `net` module - Provides the Unix domain socket client through `net.createConnection(socketPath)` in `src/client.ts`.
- Node `fs` module - Performs socket existence/type/ownership/permission checks in `src/client.ts` before connecting to the daemon.

**Infrastructure:**

- Native `fff-gpui` daemon - Not an npm dependency; the project instructions in `AGENTS.md` require separate installation with `brew install fff-gpui && brew services start fff-gpui`, and `src/client.ts` connects to its Unix socket.
- Homebrew services - Used operationally to run the native daemon according to `AGENTS.md`; the extension surfaces the same install/start guidance in the daemon-not-running error message in `src/client.ts`.
- VS Code Marketplace/Open VSX packaging tools - `@vscode/vsce` and `ovsx` are listed in `package.json`; `package.json` currently wires `vsce package --no-dependencies` and `vsce publish --no-dependencies` scripts.

## Configuration

**Environment:**

- VS Code settings namespace `fff-gpui` - Declared in `package.json` and read through `vscode.workspace.getConfiguration('fff-gpui')` in `src/config.ts` and `src/commands/runCustomTask.ts`.
- `fff-gpui.socketPath` - Optional string setting declared in `package.json`; `src/config.ts` reads it, and `src/commands/findFiles.ts` plus `src/commands/grepFiles.ts` pass it to `sendCommand()`.
- `fff-gpui.customTasks` - Optional array setting declared in `package.json`; `src/commands/runCustomTask.ts` reads task labels/commands and runs the selected command in a VS Code terminal.
- Workspace/search root fallback - `src/commands/findFiles.ts` and `src/commands/grepFiles.ts` prefer the first VS Code workspace folder, then the active editor's directory, then `os.homedir()`.

**Build:**

- TypeScript config - `tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, `isolatedModules`, `moduleResolution: 'bundler'`, `sourceMap`, and output directory `dist`.
- Bundle config - `tsup.config.ts` uses entry `src/extension.ts`, CommonJS format, Node platform, external `vscode`, bundled `reactive-vscode`, sourcemaps, clean output, and no minification.
- Lint/format config - `biome.json` enables recommended rules, import organisation, two-space indentation, single quotes, trailing commas, no semicolons, and `style.useImportType` as an error.
- Test config - `vitest.config.ts` runs tests in a Node environment and includes `test/**/*.test.ts`.
- Extension manifest - `package.json` declares activation events, commands, keybindings, settings schema, extension metadata, and `main: './dist/extension.js'`.

## Platform Requirements

**Development:**

- VS Code-compatible extension development environment - `package.json` requires VS Code `^1.85.0`, `@types/vscode` is pinned to `^1.85.0`, and extension APIs are used throughout `src/`.
- Node.js tooling compatible with ES2022 and TypeScript - `tsconfig.json` and `tsup.config.ts` target ES2022, while `package.json` supplies scripts for linting, typechecking, testing, building, packaging, and publishing.
- pnpm-managed dependencies - `package.json` declares `pnpm@11.8.0` and the repo includes `pnpm-lock.yaml`.
- Native daemon installed separately - `AGENTS.md` says developers/users install and start `fff-gpui` with Homebrew before the extension can return selections.

**Production:**

- VS Code Extension Host - The packaged extension entrypoint is `dist/extension.js` declared in `package.json` and produced from `src/extension.ts` by `tsup.config.ts`.
- Local Unix-like OS with Unix domain socket support - `src/client.ts` communicates over a Unix socket at `~/.local/state/fff-gpui/fff-gpui.sock` by default; this integration is platform-specific and not implemented as TCP/HTTP.
- Running `fff-gpui` daemon owned by the current user - `src/client.ts` validates the socket is a socket, rejects world-writable sockets, and rejects sockets owned by another UID before sending commands.

---

_Stack analysis: 2026-06-23_
