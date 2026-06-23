# Testing Patterns

**Analysis Date:** 2026-06-23

## Test Framework

**Runner:**

- Vitest `^2.0.0` from `package.json`.
- Config: `vitest.config.ts`
- `vitest.config.ts` includes `test/**/*.test.ts` and uses the `node` environment, matching the socket client tests in `test/client.test.ts`.

**Assertion Library:**

- Vitest built-in assertions via `expect` imported from `vitest` in `test/client.test.ts`.

**Run Commands:**

```bash
npm test              # Run all tests via vitest run
npm run test:watch    # Watch mode via vitest
# No coverage command is defined in package.json
```

## Test File Organization

**Location:**

- Tests are in a separate root `test/` directory, not co-located with source. The current test file is `test/client.test.ts` for `src/client.ts`.

**Naming:**

- Test files use `*.test.ts`; `vitest.config.ts` includes `test/**/*.test.ts`.

**Structure:**

```
test/
  client.test.ts        # unit tests for src/client.ts
src/
  client.ts             # code under test
```

## Test Structure

**Suite Organization:**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSocketPath, sendCommand, verifySocketSecurity } from "../src/client";

vi.mock("node:net");

const MockSocket = {
  on: vi.fn(),
  write: vi.fn(),
  destroy: vi.fn(),
  setTimeout: vi.fn(),
};

describe("sendCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a properly formatted JSON command on connect", async () => {
    let connectHandler: () => void = () => {};
    MockSocket.on.mockImplementation((event: string, handler: () => void) => {
      if (event === "connect") connectHandler = handler;
    });
    (net.createConnection as any).mockReturnValue(MockSocket);

    const promise = sendCommand({ cmd: "open_path", path: "/tmp/test", in_grep: false });
    connectHandler();

    expect(MockSocket.write).toHaveBeenCalledWith(
      '{"cmd":"open_path","path":"/tmp/test","in_grep":false}\n',
    );
  });
});
```

**Patterns:**

- Tests are grouped by exported function: `describe('sendCommand')`, `describe('resolveSocketPath')`, and `describe('verifySocketSecurity')` in `test/client.test.ts`.
- Setup uses `beforeEach(() => { vi.clearAllMocks() })` for the socket-oriented `sendCommand` suite in `test/client.test.ts`.
- Assertions use `toHaveBeenCalledWith`, `resolves.toEqual`, `rejects.toThrow`, `toBe`, and `not.toThrow` in `test/client.test.ts`.
- Event-driven async behavior is tested by capturing registered socket callbacks from `MockSocket.on.mockImplementation()` and invoking them manually in `test/client.test.ts`.

## Mocking

**Framework:** Vitest `vi.mock`, `vi.fn`, and `vi.mocked`

**Patterns:**

```typescript
vi.mock("node:net");

vi.mock("node:fs", () => ({
  statSync: vi.fn().mockImplementation(() => {
    const err = new Error("ENOENT") as any;
    err.code = "ENOENT";
    throw err;
  }),
  existsSync: vi.fn().mockReturnValue(false),
}));

vi.mock("node:os", () => ({
  homedir: () => "/mock/home",
  userInfo: () => ({ uid: 1000 }),
}));

const MockSocket = {
  on: vi.fn(),
  write: vi.fn(),
  destroy: vi.fn(),
  setTimeout: vi.fn(),
};
```

```typescript
let errorHandler: (err: NodeJS.ErrnoException) => void = () => {};
MockSocket.on.mockImplementation((event: string, handler: unknown) => {
  if (event === "error") errorHandler = handler as (err: NodeJS.ErrnoException) => void;
});
(net.createConnection as any).mockReturnValue(MockSocket);

const promise = sendCommand({ cmd: "open_path", path: "/tmp/test" });

const err = new Error("ENOENT") as NodeJS.ErrnoException;
err.code = "ENOENT";
errorHandler(err);

await expect(promise).rejects.toThrow("fff-gpui daemon is not running");
```

**What to Mock:**

- Mock Node networking for unit tests of socket behavior: `node:net` and `net.createConnection` in `test/client.test.ts`.
- Mock filesystem/security checks for deterministic socket existence and permissions: `node:fs` (`statSync`, `existsSync`) in `test/client.test.ts`.
- Mock OS home/user values to make path resolution deterministic: `node:os` (`homedir`, `userInfo`) in `test/client.test.ts`.
- Mock socket event callbacks (`connect`, `data`, `end`, `error`, `timeout`) rather than opening a real Unix socket in `test/client.test.ts`.

**What NOT to Mock:**

- Do not mock pure path-resolution logic itself; call `resolveSocketPath()` directly and assert concrete paths in `test/client.test.ts`.
- Do not mock the functions under test from `src/client.ts`; import `resolveSocketPath`, `sendCommand`, and `verifySocketSecurity` directly in `test/client.test.ts`.
- Do not require a real `fff-gpui` daemon, Unix socket, or VS Code host for current unit tests; `test/client.test.ts` stays in Vitest's Node environment.

## Fixtures and Factories

**Test Data:**

```typescript
const response = JSON.stringify({
  paths: [{ path: "/tmp/foo.ts", line: 12, column: 5 }],
});
dataHandler(Buffer.from(response));
endHandler();

await expect(promise).resolves.toEqual({
  paths: [{ path: "/tmp/foo.ts", line: 12, column: 5 }],
});
```

```typescript
vi.mocked(fs.statSync).mockReturnValueOnce({
  isSocket: () => true,
  uid: 1000,
  mode: 0o600,
} as any);
expect(() => verifySocketSecurity("/secure.sock")).not.toThrow();
```

**Location:**

- Fixtures are inline in `test/client.test.ts`; there is no separate fixtures directory.
- Reusable mock socket state is a module-level `MockSocket` object in `test/client.test.ts`.

## Coverage

**Requirements:** None enforced. `package.json` has `test` and `test:watch` scripts, but no coverage script or Vitest coverage settings in `vitest.config.ts`.

**View Coverage:**

```bash
# No coverage command is defined in package.json
# If coverage is added later, configure Vitest coverage in vitest.config.ts first
```

## Test Types

**Unit Tests:**

- Current tests are unit tests for `src/client.ts`, covering socket command serialization, response parsing, empty responses, socket error mapping, timeout handling, socket path overrides, `resolveSocketPath()` variants, and `verifySocketSecurity()` permission/ownership validation in `test/client.test.ts`.

**Integration Tests:**

- Not currently present. There are no tests that start a real `fff-gpui` daemon, connect to a real Unix socket, or run inside a VS Code extension host. `vitest.config.ts` uses `environment: 'node'`.

**E2E Tests:**

- Not used. `package.json` does not define a VS Code extension host test command, Playwright command, or other E2E runner.

## Common Patterns

**Async Testing:**

```typescript
const promise = sendCommand({ cmd: "open_path", path: "/tmp/test" });
connectHandler();

dataHandler(Buffer.from(response));
endHandler();

await expect(promise).resolves.toEqual({
  paths: [{ path: "/tmp/foo.ts", line: 12, column: 5 }],
});
```

**Error Testing:**

```typescript
const promise = sendCommand({ cmd: "open_path", path: "/tmp/test" });

const err = new Error("ECONNREFUSED") as NodeJS.ErrnoException;
err.code = "ECONNREFUSED";
errorHandler(err);

await expect(promise).rejects.toThrow("fff-gpui daemon is not running (daemon is not listening)");
```

---

_Testing analysis: 2026-06-23_
