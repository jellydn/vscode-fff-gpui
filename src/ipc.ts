import * as net from 'node:net'

export function sendSocketMessage(socketPath: string, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath)
    let data = ''

    socket.on('connect', () => {
      socket.write(`${payload}\n`)
    })

    socket.on('data', (chunk: Buffer) => {
      data += chunk.toString()
    })

    socket.on('end', () => {
      resolve(data.trim())
    })

    socket.on('error', (err: NodeJS.ErrnoException) => {
      reject(err)
    })

    socket.setTimeout(60_000)
    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('Connection timed out while waiting for file selection'))
    })
  })
}
