import * as vscode from 'vscode'

export function getSocketPath(): string {
  return vscode.workspace.getConfiguration('fff-gpui').get<string>('socketPath', '')
}
