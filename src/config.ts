import * as vscode from 'vscode'

export function getSocketPath(): string | undefined {
  return vscode.workspace.getConfiguration('fff-gpui').get<string>('socketPath') || undefined
}
