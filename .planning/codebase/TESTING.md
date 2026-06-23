# Testing Patterns

**Analysis Date:** 2026-06-23

## Test Framework

**Runner:**
- Vitest ^2.0.0
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest (`expect`, `vi`)

**Run Commands:**
```bash
npm test               # Run all tests
npm run test:watch     # Watch mode
npx vitest run --coverage  # Coverage
```

## Test File Organization

**Location:**
- Separate `test/` directory at the project root.

**Naming:**
- Named using the suffix `*.test.ts` (e.g., `client.test.ts`).

**Structure:**
```
test/
└── client.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendCommand } from '../src/client'

describe('sendCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends a properly formatted JSON command on connect', async () => {
    // Test logic here
  })
})
```

**Patterns:**
- Setup pattern: Using `beforeEach` to run `vi.clearAllMocks()`.
- Teardown pattern: Relies on `beforeEach` cleanup of mocks instead of explicit `afterEach` hooks.
- Assertion pattern: Using Vitest assertions like `expect(...).toHaveBeenCalledWith(...)`, `expect(...).resolves.toEqual(...)`, and `expect(...).rejects.toThrow(...)`.

## Mocking

**Framework:** Vitest Built-in Mocking (`vi`)

**Patterns:**
```typescript
import * as net from 'node:net'
import { vi } from 'vitest'

vi.mock('node:net')

const MockSocket = {
  on: vi.fn(),
  write: vi.fn(),
  destroy: vi.fn(),
  setTimeout: vi.fn(),
}

// Inside describe block or test case:
;(net.createConnection as any).mockReturnValue(MockSocket)
```

**What to Mock:**
- Node.js built-in modules (`node:net` to mock TCP socket communication).
- Network socket events and methods (`write`, `destroy`, `setTimeout`, and listener register `on`).

**What NOT to Mock:**
- Pure logic, client/daemon command payload generation, and response parsing utility flows.

## Fixtures and Factories

**Test Data:**
```typescript
const response = JSON.stringify({
  paths: [{ path: '/tmp/foo.ts', line: 12, column: 5 }],
})
```

**Location:**
- Defined inline directly within the test cases.

## Coverage

**Requirements:** None enforced.

**View Coverage:**
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- Validates the JSON format of client commands.
- Simulates and tests response payloads, socket stream ending, socket errors (ENOENT, ECONNREFUSED), and socket timeout responses.

**Integration Tests:**
- None implemented.

**E2E Tests:**
- Not used.

## Common Patterns

**Async Testing:**
```typescript
const promise = sendCommand({ cmd: 'open_path', path: '/tmp/test' })
// simulate events...
await expect(promise).resolves.toEqual({ paths: [] })
```

**Error Testing:**
```typescript
const promise = sendCommand({ cmd: 'open_path', path: '/tmp/test' })
const err = new Error('ECONNREFUSED') as NodeJS.ErrnoException
err.code = 'ECONNREFUSED'
errorHandler(err)

await expect(promise).rejects.toThrow('fff-gpui daemon is not running')
```

---

*Testing analysis: 2026-06-23*
