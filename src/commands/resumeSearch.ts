import * as vscode from 'vscode'
import { log } from '../logger'

type SearchKind = 'files' | 'grep' | 'git-status' | 'todo-fixme'

interface CachedSearch {
  kind: SearchKind
}

let lastSearch: CachedSearch | null = null

export function saveSearch(kind: SearchKind): void {
  lastSearch = { kind }
  log(`Cached search: ${kind}`)
}

export function getLastSearch(): CachedSearch | null {
  return lastSearch
}

export async function resumeSearch(): Promise<void> {
  if (!lastSearch) {
    vscode.window.showInformationMessage('No previous search to resume.')
    return
  }

  // Dynamically import to avoid circular deps at module load time
  switch (lastSearch.kind) {
    case 'files': {
      const { findFiles } = await import('./findFiles')
      await findFiles()
      break
    }
    case 'grep': {
      const { grepFiles } = await import('./grepFiles')
      await grepFiles()
      break
    }
    case 'git-status': {
      const { findFiles } = await import('./findFiles')
      await findFiles()
      break
    }
    case 'todo-fixme': {
      const { grepFiles } = await import('./grepFiles')
      await grepFiles()
      break
    }
  }
}
