import * as vscode from 'vscode'
import type { PickEntry } from '../types'

export async function openFiles(entries: PickEntry[]): Promise<void> {
  if (entries.length === 0) {
    return
  }

  for (const entry of entries) {
    const uri = vscode.Uri.file(entry.path)
    const doc = await vscode.workspace.openTextDocument(uri)
    const options: vscode.TextDocumentShowOptions = {}

    if (entry.line !== undefined) {
      const line = Math.max(0, (entry.line ?? 1) - 1)
      const col = Math.max(0, (entry.column ?? 1) - 1)
      options.selection = new vscode.Selection(line, col, line, col)
    }

    await vscode.window.showTextDocument(doc, options)
  }
}
