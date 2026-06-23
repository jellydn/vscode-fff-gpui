# STACK.md — Technology Stack

## Language & Runtime

- **TypeScript 6.x** (`"strict": true`, target ES2022, module ES2022 with bundler resolution)
- **Node.js** LTS (VS Code extension runtime, `@types/node ^26.0.0`)
- **Platform**: VS Code ≥ 1.85.0 (`engines.vscode` in `package.json`)

## Package Manager

- **pnpm 11.8.0** (`packageManager` field, `pnpm-workspace.yaml`)
- Lockfile: `pnpm-lock.yaml`

## Bundler

- **tsup 8** — bundles `src/extension.ts` → `dist/extension.js` (CJS, `target: es2022`, `platform: node`)
  - External: `vscode` (provided by VS Code runtime)
  - NoExternal: `reactive-vscode` (bundled into output)
  - Config: `tsup.config.ts`

## Dependencies

### Runtime (`dependencies`)

| Package           | Version | Purpose                                                            |
| ----------------- | ------- | ------------------------------------------------------------------ |
| `reactive-vscode` | ^1.0.0  | Declarative extension lifecycle (`defineExtension` + `useCommand`) |

### Dev Dependencies

| Package          | Version | Purpose                                       |
| ---------------- | ------- | --------------------------------------------- |
| `@biomejs/biome` | ^2.0.0  | Linting + formatting                          |
| `@types/node`    | ^26.0.0 | Node.js type definitions                      |
| `@types/vscode`  | ^1.85.0 | VS Code API type definitions                  |
| `@vscode/vsce`   | ^3.9.2  | VSIX packaging                                |
| `bumpp`          | ^11.0.0 | Version bumping                               |
| `ovsx`           | ^1.0.1  | Open VSX publishing                           |
| `tsup`           | ^8.0.0  | Bundler                                       |
| `typescript`     | ^6.0.0  | TypeScript compiler                           |
| `vite`           | ^8.0.0  | Peer dependency for Vitest 4                  |
| `vitest`         | ^4.0.0  | Test runner                                   |
| `vscode-ext-gen` | ^1.6.0  | Auto-generate README tables from package.json |

## Linting & Formatting

- **Biome 2** (`biome.json`)
  - Preset: recommended rules
  - No semicolons, single quotes, trailing commas
  - 2-space indent, 100 column width
  - `noExplicitAny: off`, `useImportType: error`
  - Organize imports on save
  - Checked paths: `src/**/*.ts`, `test/**/*.ts`, config files
  - Excluded: `dist`, `node_modules`, `src/generated`

## TypeScript Configuration

- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `esModuleInterop: true`
- `moduleResolution: bundler` (for tsup compatibility)
- Excludes `dist`, `node_modules`

## Testing

- **Vitest 4** (`vitest.config.ts`)
  - Environment: `node`
  - Test files: `test/**/*.test.ts`

## CI/CD

- **GitHub Actions** — two workflows:
  - `ci.yml` — lint → typecheck → test on push/PR to `main`
  - `publish.yml` — lint → typecheck → test → build → package → publish to VS Code Marketplace + Open VSX (only on version bump)

## Pre-commit Hooks

- **prek** (`prek.toml`): local repo hooks for Biome lint, tsc typecheck, Vitest run, oxfmt markdown format
