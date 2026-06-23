import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { log } from '../logger'

export interface OverlayResult {
  tempDir: string
  cleanup: () => void
}

export function createTempOverlay(workspaceRoot: string, files: string[]): OverlayResult {
  const uniqueId = crypto.randomBytes(8).toString('hex')
  const tempDir = path.join(workspaceRoot, '.git', `fff-gpui-temp-${uniqueId}`)

  log(`Creating temporary overlay at: ${tempDir}`)
  fs.mkdirSync(tempDir, { recursive: true })

  const failures: string[] = []

  for (const file of files) {
    const srcPath = path.isAbsolute(file) ? file : path.join(workspaceRoot, file)
    const relPath = path.isAbsolute(file) ? path.relative(workspaceRoot, file) : file

    // Avoid walking out of workspaceRoot
    if (relPath.startsWith('..')) {
      continue
    }

    const destPath = path.join(tempDir, relPath)
    fs.mkdirSync(path.dirname(destPath), { recursive: true })

    let success = false
    try {
      // Try hard link first (extremely fast and doesn't depend on symlink traversal setup)
      fs.linkSync(srcPath, destPath)
      success = true
    } catch (err) {
      log(`Hard link failed for ${srcPath} -> ${destPath}: ${err}. Falling back to symlink.`)
      try {
        fs.symlinkSync(srcPath, destPath)
        success = true
      } catch (symErr) {
        log(`Symlink failed: ${symErr}. Falling back to file copy.`)
        try {
          fs.copyFileSync(srcPath, destPath)
          success = true
        } catch (copyErr) {
          log(`Copy failed: ${copyErr}`)
        }
      }
    }

    if (!success) {
      failures.push(file)
    }
  }

  if (failures.length > 0) {
    log(`Warning: Failed to link/copy some files to overlay: ${failures.join(', ')}`)
    if (failures.length === files.length) {
      throw new Error('Failed to create overlay files for search.')
    }
  }

  const cleanup = () => {
    log(`Cleaning up temporary overlay: ${tempDir}`)
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (err) {
      log(`Failed to clean up temporary directory ${tempDir}: ${err}`)
    }
  }

  return { tempDir, cleanup }
}

export function resolveOverlayPaths<T extends { path: string }>(
  tempDir: string,
  workspaceRoot: string,
  paths: T[],
): T[] {
  const resolvedTemp = path.resolve(tempDir)
  return paths.map((entry) => {
    const resolvedPath = path.resolve(entry.path)
    const relPath = path.relative(resolvedTemp, resolvedPath)

    // Safety check: if path is outside tempDir or absolute, do not rewrite
    if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
      return entry
    }

    return {
      ...entry,
      path: path.join(workspaceRoot, relPath),
    }
  })
}
