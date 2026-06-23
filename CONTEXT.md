# VS Code fff-gpui Context

Unified context and domain terminology for the vscode-fff-gpui extension.

## Language

**Daemon**:
The background `fff-gpui` service that manages the file finding and grep TUI picker.
_Avoid_: daemon process, fff-gpui service, background picker

**Socket Path**:
The filesystem path to the UNIX domain socket used for IPC between the VS Code extension and the Daemon.
_Avoid_: socket file, socket address, IPC path

**Workspace Root**:
The target directory path containing files to be searched by the Daemon.
_Avoid_: project root, search folder
