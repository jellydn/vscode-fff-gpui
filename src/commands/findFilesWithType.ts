import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as vscode from 'vscode'
import { sendCommand } from '../client'
import { getSocketPath } from '../config'
import { log } from '../logger'
import { openFiles } from './openFiles'
import { createTempOverlay, resolveOverlayPaths } from './overlay'
import { selectTypeFilter } from './typeFilter'

const execFileAsync = promisify(execFile)

async function searchWithType(inGrep: boolean): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (!workspaceRoot) {
    vscode.window.showErrorMessage(
      'fff-gpui: type-filtered search requires an open workspace folder.',
    )
    return
  }

  const typeFilter = await selectTypeFilter()
  if (!typeFilter) return

  let files: string[]
  try {
    const { stdout } = await execFileAsync('rg', ['--files', '--type', typeFilter], {
      cwd: workspaceRoot,
    })
    files = stdout.split('\n').filter(Boolean)
  } catch (err) {
    log(`rg --files --type failed: ${err}`)
    files = []
  }

  if (files.length === 0) {
    vscode.window.showInformationMessage(`No files found for type "${typeFilter}".`)
    return
  }

  const { tempDir, cleanup } = createTempOverlay(workspaceRoot, files)

  try {
    const response = await sendCommand(
      {
        cmd: 'open_path',
        path: tempDir,
        in_grep: inGrep,
      },
      getSocketPath() || undefined,
      workspaceRoot,
    )

    const resolvedPaths = resolveOverlayPaths(tempDir, workspaceRoot, response.paths)
    await openFiles(resolvedPaths)
  } catch (err) {
    vscode.window.showErrorMessage(`fff-gpui: ${err}`)
  } finally {
    cleanup()
  }
}

export async function findFilesWithType(): Promise<void> {
  await searchWithType(false)
}

export async function grepFilesWithType(): Promise<void> {
  await searchWithType(true)
}
