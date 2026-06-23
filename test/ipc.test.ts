import * as net from 'node:net'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendSocketMessage } from '../src/ipc'

vi.mock('node:net')

const MockSocket = {
  on: vi.fn(),
  write: vi.fn(),
  destroy: vi.fn(),
  setTimeout: vi.fn(),
}

describe('sendSocketMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a connection to the given socket path', () => {
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    sendSocketMessage('/tmp/test.sock', 'hello')

    expect(net.createConnection).toHaveBeenCalledWith('/tmp/test.sock')
  })

  it('writes the payload followed by a newline on connect', () => {
    let connectHandler: () => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: () => void) => {
      if (event === 'connect') connectHandler = handler
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    sendSocketMessage('/tmp/test.sock', '{"cmd":"open_path"}')

    connectHandler()

    expect(MockSocket.write).toHaveBeenCalledWith('{"cmd":"open_path"}\n')
  })

  it('resolves with empty string when no data is received before end', async () => {
    let connectHandler: () => void = () => {}
    let endHandler: () => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: () => void) => {
      if (event === 'connect') connectHandler = handler
      if (event === 'end') endHandler = handler
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendSocketMessage('/tmp/test.sock', 'ping')
    connectHandler()
    endHandler()

    await expect(promise).resolves.toBe('')
  })

  it('collects chunked data and returns the trimmed result', async () => {
    let connectHandler: () => void = () => {}
    let dataHandler: (chunk: Buffer) => void = () => {}
    let endHandler: () => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'connect') connectHandler = handler as () => void
      if (event === 'data') dataHandler = handler as (chunk: Buffer) => void
      if (event === 'end') endHandler = handler as () => void
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendSocketMessage('/tmp/test.sock', 'query')
    connectHandler()
    dataHandler(Buffer.from('{"pa'))
    dataHandler(Buffer.from('ths":["/a.ts"]}'))
    endHandler()

    await expect(promise).resolves.toBe('{"paths":["/a.ts"]}')
  })

  it('trims leading and trailing whitespace from the response', async () => {
    let connectHandler: () => void = () => {}
    let dataHandler: (chunk: Buffer) => void = () => {}
    let endHandler: () => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'connect') connectHandler = handler as () => void
      if (event === 'data') dataHandler = handler as (chunk: Buffer) => void
      if (event === 'end') endHandler = handler as () => void
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendSocketMessage('/tmp/test.sock', 'query')
    connectHandler()
    dataHandler(Buffer.from('\n  {"paths":[]}  \n'))
    endHandler()

    await expect(promise).resolves.toBe('{"paths":[]}')
  })

  it('rejects with the socket error when error event fires', async () => {
    let errorHandler: (err: NodeJS.ErrnoException) => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'error') errorHandler = handler as (err: NodeJS.ErrnoException) => void
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendSocketMessage('/tmp/test.sock', 'ping')

    const err = new Error('ECONNREFUSED') as NodeJS.ErrnoException
    err.code = 'ECONNREFUSED'
    errorHandler(err)

    await expect(promise).rejects.toThrow('ECONNREFUSED')
  })

  it('rejects with timeout error and destroys socket on timeout', async () => {
    let timeoutHandler: () => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'timeout') timeoutHandler = handler as () => void
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendSocketMessage('/tmp/test.sock', 'ping')

    timeoutHandler()

    await expect(promise).rejects.toThrow('Connection timed out while waiting for file selection')
    expect(MockSocket.destroy).toHaveBeenCalled()
  })

  it('sets a 60-second timeout on the socket', () => {
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    sendSocketMessage('/tmp/test.sock', 'ping')

    expect(MockSocket.setTimeout).toHaveBeenCalledWith(60_000)
  })
})
