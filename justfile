# justfile for vscode-fff-gpui

# List available commands
default:
    just --list

# tsup bundle src/extension.ts -> dist/extension.js (CJS)
build:
    npm run build

# tsup watch mode
dev:
    npm run dev

# Biome check
lint:
    npm run lint

# Biome check --write
lint-fix:
    npm run lint:fix

# tsc --noEmit
typecheck:
    npm run typecheck

# Vitest run
test:
    npm test

# Vitest watch mode
test-watch:
    npm run test:watch

# vsce package --no-dependencies
package:
    npm run package

# vsce publish --no-dependencies
publish:
    npm run publish

# bumpp version bump
bump:
    npm run bump

# Full release pipeline (lint -> typecheck -> test -> build + publish)
release:
    npm run release

# Dry run of release pipeline
release-dry:
    npm run release:dry
