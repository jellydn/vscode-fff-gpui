import * as vscode from 'vscode'
import { sendCommand } from '../client'
import { getSocketPath } from '../config'
import { openFiles } from './openFiles'

export async function grepFiles(): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('fff-gpui: No workspace folder open')
    return
  }

  try {
    const response = await sendCommand(
      {
        cmd: 'open_path',
        path: workspaceRoot,
        in_grep: true,
      },
      getSocketPath() || undefined,
    )
    await openFiles(response.paths)
  } catch (err) {
    vscode.window.showErrorMessage(`fff-gpui: ${err}`)
  }
}
