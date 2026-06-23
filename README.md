# vscode-fff-gpui

<p align="center">
  <img src="logo.png" alt="fff-gpui logo" width="128" height="128">
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=jellydn.vscode-fff-gpui"><img src="https://img.shields.io/visual-studio-marketplace/v/jellydn.vscode-fff-gpui?label=VS%20Code" alt="VS Code Marketplace"></a>
  <a href="https://open-vsx.org/extension/jellydn/vscode-fff-gpui"><img src="https://img.shields.io/open-vsx/v/jellydn/vscode-fff-gpui?label=Open%20VSX" alt="Open VSX Registry"></a>
  <a href="https://github.com/jellydn/vscode-fff-gpui/actions/workflows/publish.yml"><img src="https://github.com/jellydn/vscode-fff-gpui/actions/workflows/publish.yml/badge.svg" alt="Publish workflow"></a>
  <a href="https://github.com/jellydn/vscode-fff-gpui/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
</p>

A fast, keyboard-driven fuzzy file finder and live grep for VS Code — powered by [fff-gpui](https://github.com/th0jensen/fff-gpui), the native GPUI file picker.

fff-gpui gives you frecency-ranked search, syntax-highlighted previews, and git-aware file indexing in a native overlay window. This extension bridges it into VS Code so you can summon it with the same keybindings you'd use in Zed.

## ✨ Features

- **Fuzzy file search** across your workspace with frecency ranking — files you open often rise to the top
- **Live grep** with plain text, regex, and fuzzy modes — results stream as you type
- **Glob filtering** — type `**/*.rs`, `*.{ts,tsx}`, or `!node_modules` in the search bar to narrow results
- **Syntax-highlighted preview** in a side pane powered by Tree-sitter
- **Git-aware** — see modified, staged, and untracked files at a glance
- **Multi-select** with Tab to open several files at once
- **Native overlay** — the picker runs as its own window, not inside the VS Code terminal

## 📋 Prerequisites

fff-gpui must be installed and running as a background daemon.

```bash
# Install via Homebrew (macOS)
brew tap th0jensen/fff-gpui
brew install fff-gpui
brew services start fff-gpui
```

> **Note:** fff-gpui is currently macOS-only (Apple Silicon and Intel).

## 🚀 Getting Started

Once the daemon is running, open a project in VS Code and use:

- **Cmd+K Cmd+P** — Find files (type `**/*.ts` to filter by type, `git:modified` for changed files)
- **Cmd+K Cmd+F** — Grep file contents (type `TODO` to find TODOs)
- **Cmd+K Cmd+R** — Resume last search

Or open the Command Palette (`Cmd+Shift+P`) and run:

- `fff-gpui: Find Files`
- `fff-gpui: Grep Files`
- `fff-gpui: Resume Last Search`
- `fff-gpui: Run Custom Task`

The picker window opens scoped to your workspace root. Without a workspace, it falls back to the active editor's directory, then your home directory. Type to search, navigate with arrow keys, and press Enter to open the selected file(s) in VS Code.

## ⌨️ Commands

| Command | Title |
| -------------------------------- | ------------------------------------------------------- || `fff-gpui.findFiles` | fff-gpui: Find Files |
| `fff-gpui.grepFiles` | fff-gpui: Grep Files |
| `fff-gpui.resumeSearch` | fff-gpui: Resume Last Search |
| `fff-gpui.runCustomTask` | fff-gpui: Run Custom Task |

## ⚙️ Configuration

| Key                    | Description                                      | Type     | Default                           |
| ---------------------- | ------------------------------------------------ | -------- | --------------------------------- |
| `fff-gpui.socketPath`  | Custom Unix socket path for the fff-gpui daemon  | `string` | `""` (auto-detected from `$HOME`) |
| `fff-gpui.customTasks` | Custom shell tasks for 'Run Custom Task' command | `array`  | `[]`                              |

> The socket path defaults to `~/.local/state/fff-gpui/fff-gpui.sock`. Only set this if you've configured fff-gpui with a custom socket location.
>
> The path supports variable expansion:
>
> - `${workspaceFolder}` — replaced with the current workspace root path
> - `~` — replaced with your home directory
>
> **Examples:**
>
> - `${workspaceFolder}/.fff-gpui.sock` — per-project socket
> - `~/custom/fff-gpui.sock` — home-relative path

> **Security:** `Run Custom Task` executes arbitrary shell commands from workspace settings. It is **disabled in untrusted workspaces** and shows a confirmation modal with the resolved command before execution. Only trust workspaces you control.

## 🔧 Troubleshooting

### "fff-gpui daemon is not running"

Make sure the background service is active:

```bash
brew services list | grep fff-gpui
```

If it's stopped, start it:

```bash
brew services start fff-gpui
```

### Check the extension logs

Open the Output panel (`Cmd+Shift+U`) and select `fff-gpui` from the dropdown to see the extension's log messages.

### Check the daemon logs

fff-gpui writes logs to `~/.local/state/fff-gpui/fff-gpui.log`:

```bash
tail -f ~/.local/state/fff-gpui/fff-gpui.log
```

### No files found or picker is empty

The picker scopes search to the first workspace folder when one is open. If no workspace is active, it falls back to the active file's directory, then your home directory. Check the Output panel (`Cmd+Shift+U` → `fff-gpui`) to see which path is being searched.

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Lint
npm run lint

# Typecheck
npm run typecheck

# Run tests
npm test
```

## 👤 Author

👤 **jellydn**

- Website: [https://productsway.com](https://productsway.com)
- GitHub: [@jellydn](https://github.com/jellydn)

If you find this extension useful, give it a ⭐️ on [GitHub](https://github.com/jellydn/vscode-fff-gpui)!

## 📝 License

MIT License © 2026 [jellydn](https://github.com/jellydn)
