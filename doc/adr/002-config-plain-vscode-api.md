# 2. Plain vscode.workspace.getConfiguration for config

Date: 2026-06-23

## Status

Accepted

## Context

The extension needs to read its `fff-gpui.socketPath` setting from VS Code configuration. Jellydn's other extensions (`vscode-fzf-picker`, `vscode-mux`) use `reactive-vscode`'s `defineConfigObject` + `ref` for reactive configuration state. This provides automatic reactivity when settings change.

We initially tried to use the same pattern:

```typescript
import { defineConfigObject, ref } from "reactive-vscode";

const config = defineConfigObject("fff-gpui", {
  socketPath: ref(""),
});
```

However, `defineConfigObject` produces a `ConfigObject<object>` type, and TypeScript couldn't infer the property names. Accessing `config.socketPath.value` produced a type error:

```
Property 'socketPath' does not exist on type 'ConfigObject<object>'
```

## Decision

**Use plain `vscode.workspace.getConfiguration()`** instead of reactive-vscode's `defineConfigObject`.

The simple utility function is:

```typescript
import * as vscode from "vscode";

export function getSocketPath(): string {
  return vscode.workspace.getConfiguration("fff-gpui").get<string>("socketPath", "");
}
```

Called inline in the command handlers when needed:

```typescript
const response = await sendCommand(
  { cmd: "open_path", path: workspaceRoot, in_grep: false },
  getSocketPath() || undefined,
);
```

## Consequences

### Positive

- Zero type issues. `get<string>()` is well-typed from `@types/vscode`.
- Simple mental model: read config when the command runs, not reactively.
- No additional dependency surface — plain VS Code API.
- Reactive config isn't needed here because the socket path is only read at command invocation time. Even if the user changes the setting during a session, the next command invocation picks it up.

### Negative

- Slightly more verbose than `config.socketPath.value` (two lines instead of one).
- Not reactive — if we ever need to react to config changes (e.g., reconnect on socket path change), we'd need `onDidChangeConfiguration` manually. Not needed for MVP.
- Inconsistent with the reactive-vscode pattern used for command registration (`useCommand`). However, `useCommand` has clear type benefits that `defineConfigObject` didn't deliver here.

### Comparison

| Approach                            | Type safety         | Reactivity | Lines of code |
| ----------------------------------- | ------------------- | ---------- | ------------- |
| `defineConfigObject` + `ref`        | Broken (type error) | Automatic  | 4             |
| `vscode.workspace.getConfiguration` | Works               | Manual     | 5             |

Given the type error, the plain API approach was the only viable option without deep investigation into reactive-vscode's type internals.
