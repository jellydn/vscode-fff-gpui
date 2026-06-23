import * as os from 'node:os'
import * as path from 'node:path'
import * as vscode from 'vscode'
import { sendCommand } from '../client'
import { getSocketPath } from '../config'
import { openFiles } from './openFiles'

export async function findFiles(): Promise<void> {
  let searchPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (!searchPath) {
    const activeEditor = vscode.window.activeTextEditor
    if (activeEditor && activeEditor.document.uri.scheme === 'file') {
      searchPath = path.dirname(activeEditor.document.uri.fsPath)
    } else {
      searchPath = os.homedir()
    }
  }

  try {
    const response = await sendCommand(
      {
        cmd: 'open_path',
        path: searchPath,
        in_grep: false,
      },
      getSocketPath() || undefined,
      searchPath,
    )
    await openFiles(response.paths)
  } catch (err) {
    vscode.window.showErrorMessage(`fff-gpui: ${err}`)
  }
}
