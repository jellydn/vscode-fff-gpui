# 3. reactive-vscode for command registration

Date: 2026-06-23

## Status

Accepted

## Context

The VS Code extension API provides `vscode.commands.registerCommand()` for registering command handlers. The standard pattern is imperative:

```typescript
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("fff-gpui.findFiles", findFiles),
    vscode.commands.registerCommand("fff-gpui.grepFiles", grepFiles),
  );
}
```

Jellydn's extensions consistently use `reactive-vscode`'s `defineExtension` + `useCommand` which provides a declarative, auto-disposing API:

```typescript
export const { activate, deactivate } = defineExtension(() => {
  useCommand("fff-gpui.findFiles", findFiles);
  useCommand("fff-gpui.grepFiles", grepFiles);
});
```

We needed to decide whether to follow the standard VS Code pattern or Jellydn's reactive-vscode pattern.

## Decision

**Use `reactive-vscode`'s `defineExtension` + `useCommand`** for command registration, matching Jellydn's established extension conventions.

`reactive-vscode` is kept as a runtime dependency (`"dependencies"`) for the extension activation layer only. Configuration (see ADR 002) uses plain VS Code API.

## Consequences

### Positive

- Matches Jellydn's conventions across `vscode-fzf-picker`, `vscode-mux`, and other extensions.
- `defineExtension` returns `{ activate, deactivate }` — the cleanup function automatically disposes resources. No manual `context.subscriptions.push()` boilerplate.
- `useCommand` is declarative and self-documenting. Adding a new command is a single line.
- The library is lightweight (one dependency) and well-maintained.

### Negative

- Adds a runtime dependency (`reactive-vscode`) with ~0.3 MB to the bundled extension.
- Abstracting away the standard VS Code API adds a learning curve for contributors unfamiliar with reactive-vscode.
- The library's type system can be opaque (see ADR 002 — `defineConfigObject` type inference failure). We mitigate by limiting usage to `defineExtension` + `useCommand` only.
- If reactive-vscode becomes unmaintained, migrating back to `vscode.commands.registerCommand()` is straightforward — the command handler functions are pure and don't depend on the library.

### Comparison

| Approach                          | Boilerplate                | Auto-dispose | Convention match |
| --------------------------------- | -------------------------- | ------------ | ---------------- |
| `vscode.commands.registerCommand` | More (subscriptions array) | Manual       | VS Code standard |
| `defineExtension` + `useCommand`  | Less (single lines)        | Automatic    | Jellydn standard |

We chose convention alignment over standard VS Code patterns.
