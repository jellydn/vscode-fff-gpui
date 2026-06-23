import * as fs from 'node:fs'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import type { PickResponse, ServiceCommand } from './types'

function defaultSocketPath(): string {
  return path.join(os.homedir(), '.local', 'state', 'fff-gpui', 'fff-gpui.sock')
}

export function resolveSocketPath(socketPath: string, workspaceRoot?: string): string {
  let resolved = socketPath
  if (workspaceRoot && resolved.includes('${workspaceFolder}')) {
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

export function sendCommand(
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

  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath)
    let data = ''

    socket.on('connect', () => {
      socket.write(`${JSON.stringify(command)}\n`)
    })

    socket.on('data', (chunk: Buffer) => {
      data += chunk.toString()
    })

    socket.on('end', () => {
      const trimmed = data.trim()
      if (trimmed.length === 0) {
        resolve({ paths: [] })
        return
      }

      try {
        const response: PickResponse = JSON.parse(trimmed)
        resolve(response)
      } catch (err) {
        reject(new Error(`Failed to parse response from fff-gpui daemon: ${trimmed}`))
      }
    })

    socket.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
        const fileExists = fs.existsSync(socketPath)
        const detail = fileExists ? 'daemon is not listening' : 'socket file does not exist'
        reject(
          new Error(
            `fff-gpui daemon is not running (${detail}). Install with: brew install fff-gpui && brew services start fff-gpui`,
          ),
        )
      } else {
        reject(err)
      }
    })

    socket.setTimeout(60_000)
    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('Connection timed out while waiting for file selection'))
    })
  })
}
