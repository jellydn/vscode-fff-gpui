import { execFile } from 'node:child_process'
import * as path from 'node:path'
import { promisify } from 'node:util'
import * as vscode from 'vscode'
import { sendCommand } from '../client'
import { getSocketPath } from '../config'
import { log } from '../logger'
import { openFiles } from './openFiles'
import { createTempOverlay, resolveOverlayPaths } from './overlay'

const execFileAsync = promisify(execFile)

function unquoteGitFilename(filename: string): string {
  let res = filename.trim()
  if (res.startsWith('"') && res.endsWith('"')) {
    res = res.slice(1, -1)
    res = res.replaceAll('\\"', '"').replaceAll('\\\\', '\\')
  }
  return res
}

function parseGitStatusLine(line: string): string | null {
  if (!line || line.startsWith('D ') || line.startsWith(' D')) {
    return null
  }
  const status = line.slice(0, 2)
  let filepath = line.slice(3)

  if (status.includes('R') || status.includes('C')) {
    const parts = filepath.split(' -> ')
    if (parts.length > 1) {
      filepath = parts[1] || ''
    }
  }

  const unquoted = unquoteGitFilename(filepath)
  return unquoted.endsWith('/') ? null : unquoted
}

async function getGitStatusFiles(workspaceRoot: string): Promise<string[]> {
  try {
    const { stdout: gitRoot } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
      cwd: workspaceRoot,
    })
    const trimmedRoot = gitRoot.trim()

    const [statusResult, untrackedResult] = await Promise.all([
      execFileAsync('git', ['status', '--porcelain'], { cwd: workspaceRoot }),
      execFileAsync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: workspaceRoot }),
    ])

    const trackedFiles = statusResult.stdout
      .split('\n')
      .map(parseGitStatusLine)
      .filter((file): file is string => file !== null)
      .map((file) => path.resolve(trimmedRoot, file))

    const untrackedFiles = untrackedResult.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => unquoteGitFilename(line))
      .map((file) => path.resolve(trimmedRoot, file))

    const allAbsoluteFiles = [...new Set([...trackedFiles, ...untrackedFiles])]

    return allAbsoluteFiles
      .map((absPath) => {
        const relPath = path.relative(workspaceRoot, absPath)
        if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
          return null
        }
        return relPath
      })
      .filter((file): file is string => file !== null)
  } catch (err) {
    log(`Failed to get git status files: ${err}`)
    return []
  }
}

export async function pickGitStatus(): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('fff-gpui: Git Status requires an open workspace folder.')
    return
  }

  const files = await getGitStatusFiles(workspaceRoot)
  if (files.length === 0) {
    vscode.window.showInformationMessage('No changes in the git repository.')
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
