import * as vscode from 'vscode'
import type { PickEntry } from '../types'

export async function openFiles(entries: PickEntry[]): Promise<void> {
  if (entries.length === 0) {
    return
  }

  // Load all documents in parallel; allSettled so a single bad path
  // does not prevent remaining files from opening
  const loadResults = await Promise.allSettled(
    entries.map((entry) => vscode.workspace.openTextDocument(vscode.Uri.file(entry.path))),
  )

  // Pair entries with their documents, skipping failed loads
  const pairs: { entry: PickEntry; doc: vscode.TextDocument }[] = []
  for (let i = 0; i < loadResults.length; i++) {
    const result = loadResults[i]
    const entry = entries[i]
    if (!result || !entry) continue
    if (result.status === 'fulfilled') {
      pairs.push({ entry, doc: result.value })
    }
  }

  const failedCount = entries.length - pairs.length
  if (failedCount > 0) {
    vscode.window.showWarningMessage(`fff-gpui: failed to open ${failedCount} file(s)`)
  }

  // Show documents in parallel; allSettled so a single failure
  // does not prevent remaining files from opening
  const showResults = await Promise.allSettled(
    pairs.map(async ({ entry, doc }) => {
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

  for (const result of showResults) {
    if (result.status === 'rejected') {
      console.warn('fff-gpui: failed to show document:', result.reason)
    }
  }
}
