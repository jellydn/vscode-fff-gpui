# Implementation Plans — vscode-fff-gpui

Generated: 2026-06-24
Based on commit: `96c2c33`

**Senior Advisor**: The plans below are self-contained specifications for a different executor agent with no context from this session.

## Recommended execution order

```text
001 ──> 002 ──> 003
```

All three plans are independent (no file conflicts), but executing in order minimizes mental context switching.

## Dependencies

| Plan | Depends on | Blocked by |
| ---- | ---------- | ---------- |
| 001  | Nothing    | —          |
| 002  | Nothing    | —          |
| 003  | Nothing    | —          |

All three plans modify distinct files with no overlap:

- **001**: Creates `test/config.test.ts` + `test/logger.test.ts` (new files)
- **002**: Modifies `src/commands/openFiles.ts` only
- **003**: Modifies `src/config.ts` + `src/commands/runPicker.ts`

If running Plan 001 first followed by Plan 003: note that Plan 003 includes a note about updating `test/config.test.ts` if it was created by Plan 001. The two-step change is: add config tests (001) → tighten config API (003) → update config tests (003 step 3). Each step is independently verifiable.

## Status

| #   | Title                                                              | Status  | Verified          |
| --- | ------------------------------------------------------------------ | ------- | ----------------- |
| 001 | Test uncovered modules — config.ts, logger.ts                      | ✅ Done | ✅ 101 tests pass |
| 002 | Resolve logging inconsistencies — replace console.warn with logger | ✅ Done | ✅ 101 tests pass |
| 003 | Tighten config API — getSocketPath returns undefined               | ✅ Done | ✅ 101 tests pass |

## Rejected findings

| Finding                                           | Reason                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Empty workspaceFolders array edge case not tested | Correctly handled by existing code (optional chaining); test value too low to justify a plan |
| Socket path expansion literal replaceAll          | Low risk, documented in AGENTS.md. Worth fixing if similar work touches that area            |
| Console.warn on rejected show messages            | Absorbed into Plan 002 (same concern)                                                        |
| No integration test for extension lifecycle       | High effort (VS Code test runner), medium confidence. Deferred to a future session           |
