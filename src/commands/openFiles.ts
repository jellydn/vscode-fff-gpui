import * as vscode from 'vscode'
import type { PickEntry } from '../types'

export async function openFiles(entries: PickEntry[]): Promise<void> {
  if (entries.length === 0) {
    return
  }

  // Load all documents in parallel
  const docs = await Promise.all(
    entries.map((entry) => vscode.workspace.openTextDocument(vscode.Uri.file(entry.path))),
  )

  // Show documents in parallel; Promise.allSettled so a single failure
  // does not prevent remaining files from opening
  const results = await Promise.allSettled(
    entries.map(async (entry, i) => {
      const doc = docs[i]
      if (!entry || !doc) return

      const options: vscode.TextDocumentShowOptions = {
        preview: false,
      }

      if (entry.line !== undefined) {
        const line = Math.max(0, (entry.line ?? 1) - 1)
        const col = Math.max(0, (entry.column ?? 1) - 1)
        options.selection = new vscode.Selection(line, col, line, col)
      }

      await vscode.window.showTextDocument(doc, options)
    }),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('fff-gpui: failed to show document:', result.reason)
    }
  }
}
