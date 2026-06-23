# 4. Git Status and TODO pickers via workspace overlay

Date: 2026-06-23

## Status

Accepted

## Context

The user requested similar functionality to `vscode-fzf-picker` for finding files based on `git status` and finding `TODO/FIXME` comments.

Unlike `vscode-fzf-picker` which executes `fzf` in an active VS Code terminal instance and can accept arbitrary file lists or query inputs, `vscode-fff-gpui` communicates with a resident `fff-gpui` daemon over a Unix socket using a fixed IPC protocol.

The `fff-gpui` daemon's IPC protocol (`ServiceCommand`) only accepts:
1. `OpenPath { path: PathBuf, in_grep: bool }` (opens picker in a directory path)
2. `OpenOneShot { path: PathBuf, in_grep: bool }`
3. Toggle/Config/Quit commands

It does not support passing a predefined query, a subset list of files to search, or a custom grep pattern to run on start. The daemon always performs a full directory scan (respecting `.gitignore`) and content grep on the folder path it was commanded to open.

To support `Git Status` (showing only changed/untracked files) and `TODO/FIXME` (showing only files containing TODO tags) while preserving the native `fff-gpui` TUI/GUI window experience, we need to present the daemon with a directory that contains only the target files.

## Decision

**Implement the Git Status and TODO pickers by dynamically creating a temporary directory workspace overlay.**

1. Gather the target file paths using fast local commands (`git status`, `git ls-files`, `rg`, or `git grep`).
2. Create a unique temporary directory inside the project's `.git/` folder (e.g. `.git/fff-gpui-temp-<unique-id>`).
3. Replicate the relative path structure of the workspace inside the temporary directory, creating hard links (with fallback to symlinks or direct file copies) to the target files.
4. Send an `OpenPath` command to the `fff-gpui` daemon pointing to the temporary directory.
5. In the VS Code client, listen for the daemon's response. When a selection is returned, map the relative paths in the temporary directory back to the actual files in the workspace and open them.
6. Clean up the temporary directory immediately after the daemon returns or fails.

## Consequences

### Positive

- **Preserves Native Experience**: The user gets the native Zed/GPUI window interface for both git status and TODO lists instead of a standard VS Code Quick Pick.
- **Fast Scanning**: Replicating only the target files (often a small subset of the repository) makes `fff-gpui`'s indexing near-instantaneous.
- **Disk Safe**: Creating the temporary directory inside `.git/` avoids polluting the user's active file workspace, and the directory is naturally git-ignored.
- **FS Volume Compatibility**: Placing the temp folder within the project workspace guarantees it resides on the same filesystem volume, enabling OS hard links (instant, no content copies).
- **Fallback Tolerant**: If hard links fail (e.g. directory restrictions), the mechanism falls back to symlinks and then to actual copies.

### Negative

- **No Line-Level Positioning for TODOs**: Since the daemon only shows the file list (or runs general grep on the overlay folder), the client cannot automatically place the cursor at the specific TODO line when the picker opens. The user gets the list of files containing TODOs and can fuzzy search them.
- **File System Write Overhead**: Creating folders and hard links adds slight I/O overhead before launching the picker (mitigated by using hard links/symlinks).
- **Cleanup Risk**: If VS Code crashes or is closed abruptly while the picker is active, the temporary directory under `.git/` may not be cleaned up immediately (though it is git-ignored and won't affect git operations).
