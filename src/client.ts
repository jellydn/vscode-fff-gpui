import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { sendSocketMessage } from './ipc'
import { log } from './logger'
import { isPickResponse, type PickResponse, type ServiceCommand } from './types'

function defaultSocketPath(): string {
  return path.join(os.homedir(), '.local', 'state', 'fff-gpui', 'fff-gpui.sock')
}

export function resolveSocketPath(socketPath: string, workspaceRoot?: string): string {
  let resolved = socketPath
  // biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${workspaceFolder} string
  if (workspaceRoot && resolved.includes('${workspaceFolder}')) {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${workspaceFolder} string
    resolved = resolved.replaceAll('${workspaceFolder}', workspaceRoot)
  }
  if (resolved.startsWith('~')) {
    resolved = path.join(os.homedir(), resolved.slice(1))
  } else if (!path.isAbsolute(resolved)) {
    if (workspaceRoot) {
      resolved = path.resolve(workspaceRoot, resolved)
    } else {
      resolved = path.resolve(os.homedir(), resolved)
    }
  }
  return resolved
}

export function verifySocketSecurity(socketPath: string): void {
  try {
    const stats = fs.statSync(socketPath)
    if (!stats.isSocket()) {
      throw new Error('Path exists but is not a socket')
    }
    const userInfo = os.userInfo()
    if (
      typeof stats.uid === 'number' &&
      stats.uid >= 0 &&
      typeof userInfo.uid === 'number' &&
      userInfo.uid >= 0
    ) {
      if (stats.uid !== userInfo.uid) {
        throw new Error(
          `Socket file is not owned by the current user (owner UID: ${stats.uid}, current UID: ${userInfo.uid})`,
        )
      }
    }
    if ((stats.mode & 0o002) !== 0) {
      throw new Error('Socket file is world-writable')
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      throw err
    }
  }
}

export async function sendCommand(
  command: ServiceCommand,
  socketPathOverride?: string,
  workspaceRoot?: string,
): Promise<PickResponse> {
  const socketPath = resolveSocketPath(socketPathOverride || defaultSocketPath(), workspaceRoot)

  try {
    verifySocketSecurity(socketPath)
  } catch (err: any) {
    return Promise.reject(err)
  }

  let raw: string
  try {
    raw = await sendSocketMessage(socketPath, JSON.stringify(command))
  } catch (err: any) {
    if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
      const fileExists = fs.existsSync(socketPath)
      const detail = fileExists ? 'daemon is not listening' : 'socket file does not exist'
      throw new Error(
        `fff-gpui daemon is not running (${detail}). Install with: brew install fff-gpui && brew services start fff-gpui`,
      )
    }
    throw err
  }

  if (raw.length === 0) {
    return { paths: [] }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (_err) {
    // Log full payload to output channel; truncate in user-facing message
    log(`Failed to parse response from fff-gpui daemon: ${raw}`)
    const preview = raw.length > 100 ? `${raw.slice(0, 100)}…` : raw
    throw new Error(`Failed to parse response from fff-gpui daemon: ${preview}`)
  }

  if (!isPickResponse(parsed)) {
    throw new Error(
      'fff-gpui daemon returned an invalid response (expected { paths: PickEntry[] })',
    )
  }

  return parsed
}
