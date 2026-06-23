import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import type { PickResponse, ServiceCommand } from './types'

function defaultSocketPath(): string {
  return path.join(os.homedir(), '.local', 'state', 'fff-gpui', 'fff-gpui.sock')
}

export function sendCommand(
  command: ServiceCommand,
  socketPathOverride?: string,
): Promise<PickResponse> {
  const socketPath = socketPathOverride || defaultSocketPath()

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
        reject(
          new Error(
            'fff-gpui daemon is not running. Install with: brew install fff-gpui && brew services start fff-gpui',
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
