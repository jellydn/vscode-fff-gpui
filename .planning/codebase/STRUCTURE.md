# Codebase Structure

**Analysis Date:** 2026-06-23

## Directory Layout

```
[project-root]/
├── .github/              # GitHub workflows configuration
├── .planning/            # System documentation and planning
│   └── codebase/         # Architecture & structure details
├── dist/                 # Built JavaScript output bundle
├── doc/                  # Project-wide documentation resources
├── src/                  # Source typescript folder
│   ├── commands/         # VS Code extension commands implementations
│   └── [files]           # Extension configuration, entry point and client API
├── test/                 # Test files directory
└── [config files]        # Biome, TypeScript, Tsup, and Vitest build rules
```

## Directory Purposes

**src/:**

- Purpose: Contains main implementation of the VS Code extension.
- Contains: TypeScript files for socket daemon client, config utility, and entry point.
- Key files: `src/extension.ts`, `src/client.ts`

**src/commands/:**

- Purpose: Command executors that process file searches and focus results inside the active window.
- Contains: Command callbacks and VS Code document manipulation scripts.
- Key files: `src/commands/findFiles.ts`, `src/commands/grepFiles.ts`, `src/commands/openFiles.ts`

**test/:**

- Purpose: Unit testing suite using Vitest framework.
- Contains: Mock-heavy UNIX Socket communication tests.
- Key files: `test/client.test.ts`

**.planning/codebase/:**

- Purpose: Contains documentation files describing codebase organization.
- Contains: Markdown architecture maps.
- Key files: `ARCHITECTURE.md`, `STRUCTURE.md`

## Key File Locations

**Entry Points:**

- `src/extension.ts`: Main entry point initialized by the VS Code extension host process.

**Configuration:**

- `package.json`: Manages extension details, dependencies, settings declaration (`fff-gpui.socketPath`), and default shortcut keys.
- `src/config.ts`: Wrapper function to query workspace settings.

## Core Logic:\*\*

- `src/client.ts`: Connection initiator that sends json payloads via UNIX sockets.
- `src/types.ts`: Interface structures for IPC commands, responses, and entries.

**Testing:**

- `test/client.test.ts`: Client unit tests that mock the standard `node:net` module.

## Naming Conventions

**Files:**

- camelCase: Used for all code source files. Example: `findFiles.ts`, `openFiles.ts`.

**Directories:**

- lowercase/kebab-case: Keep directories simple. Example: `commands`.

## Where to Add New Code

**New Feature:**

- Primary code: Implement under a new file in `src/commands/`, configure VS Code mappings in `package.json`, and invoke within `src/extension.ts`.
- Tests: Add corresponding client mock tests or integration tests inside `test/`.

**New Component/Module:**

- Implementation: Put inside a dedicated directory under `src/` (e.g. `src/utils/` or `src/services/` if the project grows).

**Utilities:**

- Shared helpers: Define in `src/` (such as `src/logger.ts`).

## Special Directories

**dist/:**

- Purpose: Output bundle parsed from src folder.
- Generated: Yes
- Committed: No

**node_modules/:**

- Purpose: Package dependencies downloaded from PNPM lockfile.
- Generated: Yes
- Committed: No

**.planning/:**

- Purpose: Stores system design docs.
- Generated: No
- Committed: Yes

---

_Structure analysis: 2026-06-23_
