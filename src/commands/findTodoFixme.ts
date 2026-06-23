import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as vscode from 'vscode'
import { sendCommand } from '../client'
import { getSocketPath } from '../config'
import { log } from '../logger'
import { openFiles } from './openFiles'
import { createTempOverlay, resolveOverlayPaths } from './overlay'

const execFileAsync = promisify(execFile)

async function getTodoFiles(workspaceRoot: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      [
        'grep',
        '--untracked',
        '-l',
        '-w',
        '-E',
        '-e',
        '(TODO|FIXME|HACK|FIX)',
        '-e',
        '(todo|fixme|hack|fix)(:|[[:space:]]+-|[[:space:]]*\\()',
        '.',
      ],
      { cwd: workspaceRoot },
    )
    return stdout.split('\n').filter(Boolean)
  } catch (err) {
    log(`git grep search failed or no matches found: ${err}`)
    return []
  }
}

export async function findTodoFixme(): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('fff-gpui: TODO search requires an open workspace folder.')
    return
  }

  const files = await getTodoFiles(workspaceRoot)
  if (files.length === 0) {
    vscode.window.showInformationMessage('No TODO/FIXME comments found.')
    return
  }

  const { tempDir, cleanup } = createTempOverlay(workspaceRoot, files)

  try {
    const response = await sendCommand(
      {
        cmd: 'open_path',
        path: tempDir,
        in_grep: false,
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
