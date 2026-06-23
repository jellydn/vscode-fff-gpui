import * as path from 'node:path'

export interface SearchContext {
  workspaceFolders: readonly { uri: { fsPath: string } }[] | undefined
  activeEditor: { document: { uri: { fsPath: string; scheme: string } } } | undefined
  homedir: string
}

export function resolveSearchTarget(ctx: SearchContext): string {
  const workspacePath = ctx.workspaceFolders?.[0]?.uri.fsPath
  if (workspacePath) {
    return workspacePath
  }

  const editor = ctx.activeEditor
  if (editor && editor.document.uri.scheme === 'file') {
    return path.dirname(editor.document.uri.fsPath)
  }

  return ctx.homedir
}
