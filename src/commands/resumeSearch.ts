import * as vscode from 'vscode'
import { log } from '../logger'

type SearchKind =
  | 'files'
  | 'files-with-type'
  | 'grep'
  | 'grep-with-type'
  | 'git-status'
  | 'todo-fixme'

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
    case 'files-with-type': {
      const { findFilesWithType } = await import('./findFilesWithType')
      await findFilesWithType()
      break
    }
    case 'grep': {
      const { grepFiles } = await import('./grepFiles')
      await grepFiles()
      break
    }
    case 'grep-with-type': {
      const { grepFilesWithType } = await import('./findFilesWithType')
      await grepFilesWithType()
      break
    }
    case 'git-status': {
      const { pickGitStatus } = await import('./pickGitStatus')
      await pickGitStatus()
      break
    }
    case 'todo-fixme': {
      const { findTodoFixme } = await import('./findTodoFixme')
      await findTodoFixme()
      break
    }
  }
}
