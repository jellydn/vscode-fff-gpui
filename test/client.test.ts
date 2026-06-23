import * as net from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendCommand } from '../src/client'

vi.mock('node:net')

const MockSocket = {
  on: vi.fn(),
  write: vi.fn(),
  destroy: vi.fn(),
  setTimeout: vi.fn(),
}

describe('sendCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends a properly formatted JSON command on connect', async () => {
    let connectHandler: () => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: () => void) => {
      if (event === 'connect') connectHandler = handler
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendCommand({ cmd: 'open_path', path: '/tmp/test', in_grep: false })

    connectHandler()

    expect(MockSocket.write).toHaveBeenCalledWith(
      '{"cmd":"open_path","path":"/tmp/test","in_grep":false}\n',
    )

    const endHandler = MockSocket.on.mock.calls.find((call: [string]) => call[0] === 'end')?.[1] as
      | (() => void)
      | undefined
    endHandler?.()

    await expect(promise).resolves.toEqual({ paths: [] })
  })

  it('resolves with empty paths when daemon responds with empty data', async () => {
    let connectHandler: () => void = () => {}
    let endHandler: () => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: () => void) => {
      if (event === 'connect') connectHandler = handler
      if (event === 'end') endHandler = handler
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendCommand({ cmd: 'open_path', path: '/tmp/test' })
    connectHandler()
    endHandler()

    await expect(promise).resolves.toEqual({ paths: [] })
  })

  it('parses a valid PickResponse with paths and line/column', async () => {
    let connectHandler: () => void = () => {}
    let dataHandler: (chunk: Buffer) => void = () => {}
    let endHandler: () => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'connect') connectHandler = handler as () => void
      if (event === 'data') dataHandler = handler as (chunk: Buffer) => void
      if (event === 'end') endHandler = handler as () => void
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendCommand({ cmd: 'open_path', path: '/tmp/test' })
    connectHandler()

    const response = JSON.stringify({
      paths: [{ path: '/tmp/foo.ts', line: 12, column: 5 }],
    })
    dataHandler(Buffer.from(response))
    endHandler()

    await expect(promise).resolves.toEqual({
      paths: [{ path: '/tmp/foo.ts', line: 12, column: 5 }],
    })
  })

  it('rejects with ENOENT error when daemon socket does not exist', async () => {
    let errorHandler: (err: NodeJS.ErrnoException) => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'error') errorHandler = handler as (err: NodeJS.ErrnoException) => void
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendCommand({ cmd: 'open_path', path: '/tmp/test' })

    const err = new Error('ENOENT: no such file') as NodeJS.ErrnoException
    err.code = 'ENOENT'
    errorHandler(err)

    await expect(promise).rejects.toThrow('fff-gpui daemon is not running')
  })

  it('rejects with ECONNREFUSED error when daemon is not listening', async () => {
    let errorHandler: (err: NodeJS.ErrnoException) => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'error') errorHandler = handler as (err: NodeJS.ErrnoException) => void
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendCommand({ cmd: 'open_path', path: '/tmp/test' })

    const err = new Error('ECONNREFUSED') as NodeJS.ErrnoException
    err.code = 'ECONNREFUSED'
    errorHandler(err)

    await expect(promise).rejects.toThrow('fff-gpui daemon is not running')
  })

  it('rejects on invalid JSON response', async () => {
    let connectHandler: () => void = () => {}
    let dataHandler: (chunk: Buffer) => void = () => {}
    let endHandler: () => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'connect') connectHandler = handler as () => void
      if (event === 'data') dataHandler = handler as (chunk: Buffer) => void
      if (event === 'end') endHandler = handler as () => void
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendCommand({ cmd: 'open_path', path: '/tmp/test' })
    connectHandler()
    dataHandler(Buffer.from('not json'))
    endHandler()

    await expect(promise).rejects.toThrow('Failed to parse response')
  })

  it('rejects on socket timeout', async () => {
    let timeoutHandler: () => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'timeout') timeoutHandler = handler as () => void
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendCommand({ cmd: 'open_path', path: '/tmp/test' })

    timeoutHandler()

    await expect(promise).rejects.toThrow('Connection timed out')
    expect(MockSocket.destroy).toHaveBeenCalled()
  })

  it('uses the provided socketPath override instead of default', () => {
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    sendCommand({ cmd: 'open_path', path: '/tmp/test' }, '/custom/socket.sock')

    expect(net.createConnection).toHaveBeenCalledWith('/custom/socket.sock')
  })
})
