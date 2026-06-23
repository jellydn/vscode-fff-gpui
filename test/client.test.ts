import * as fs from 'node:fs'
import * as net from 'node:net'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveSocketPath, sendCommand, verifySocketSecurity } from '../src/client'

vi.mock('node:net')

vi.mock('node:fs', () => ({
  statSync: vi.fn().mockImplementation(() => {
    const err = new Error('ENOENT') as any
    err.code = 'ENOENT'
    throw err
  }),
  existsSync: vi.fn().mockReturnValue(false),
}))

vi.mock('node:os', () => ({
  homedir: () => '/mock/home',
  userInfo: () => ({ uid: 1000 }),
}))

vi.mock('../src/logger', () => ({
  log: vi.fn(),
}))

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

    const endHandler = MockSocket.on.mock.calls.find((call: any[]) => call[0] === 'end')?.[1] as
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

  it('rejects when response is valid JSON but not a PickResponse (empty object)', async () => {
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
    dataHandler(Buffer.from(JSON.stringify({})))
    endHandler()

    await expect(promise).rejects.toThrow('invalid response')
  })

  it('rejects when paths is null', async () => {
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
    dataHandler(Buffer.from(JSON.stringify({ paths: null })))
    endHandler()

    await expect(promise).rejects.toThrow('invalid response')
  })

  it('rejects when an entry is missing path', async () => {
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
    dataHandler(Buffer.from(JSON.stringify({ paths: [{ line: 1 }] })))
    endHandler()

    await expect(promise).rejects.toThrow('invalid response')
  })

  it('rejects when an entry path is not a string', async () => {
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
    dataHandler(Buffer.from(JSON.stringify({ paths: [{ path: 123 }] })))
    endHandler()

    await expect(promise).rejects.toThrow('invalid response')
  })

  it('rejects when entry has non-numeric line', async () => {
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
    dataHandler(Buffer.from(JSON.stringify({ paths: [{ path: '/ok.ts', line: 'not-a-number' }] })))
    endHandler()

    await expect(promise).rejects.toThrow('invalid response')
  })

  it('accepts entry with string path and numeric line/column', async () => {
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
    dataHandler(Buffer.from(JSON.stringify({ paths: [{ path: '/ok.ts', line: 5, column: 3 }] })))
    endHandler()

    await expect(promise).resolves.toEqual({
      paths: [{ path: '/ok.ts', line: 5, column: 3 }],
    })
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

  it('differentiates ENOENT error when socket file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValueOnce(false)
    let errorHandler: (err: NodeJS.ErrnoException) => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'error') errorHandler = handler as (err: NodeJS.ErrnoException) => void
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendCommand({ cmd: 'open_path', path: '/tmp/test' })

    const err = new Error('ENOENT') as NodeJS.ErrnoException
    err.code = 'ENOENT'
    errorHandler(err)

    await expect(promise).rejects.toThrow(
      'fff-gpui daemon is not running (socket file does not exist)',
    )
  })

  it('differentiates ECONNREFUSED error when socket file exists but daemon is not listening', async () => {
    vi.mocked(fs.existsSync).mockReturnValueOnce(true)
    let errorHandler: (err: NodeJS.ErrnoException) => void = () => {}
    MockSocket.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'error') errorHandler = handler as (err: NodeJS.ErrnoException) => void
    })
    ;(net.createConnection as any).mockReturnValue(MockSocket)

    const promise = sendCommand({ cmd: 'open_path', path: '/tmp/test' })

    const err = new Error('ECONNREFUSED') as NodeJS.ErrnoException
    err.code = 'ECONNREFUSED'
    errorHandler(err)

    await expect(promise).rejects.toThrow(
      'fff-gpui daemon is not running (daemon is not listening)',
    )
  })
})

describe('resolveSocketPath', () => {
  it('resolves tilde to homedir', () => {
    const resolved = resolveSocketPath('~/foo/bar.sock')
    expect(resolved).toBe('/mock/home/foo/bar.sock')
  })

  it('resolves relative path using workspaceRoot if provided', () => {
    const resolved = resolveSocketPath('foo/bar.sock', '/workspace')
    expect(resolved).toBe('/workspace/foo/bar.sock')
  })

  it('resolves relative path using homedir if workspaceRoot is not provided', () => {
    const resolved = resolveSocketPath('foo/bar.sock')
    expect(resolved).toBe('/mock/home/foo/bar.sock')
  })

  it('preserves absolute paths', () => {
    const resolved = resolveSocketPath('/absolute/path.sock')
    expect(resolved).toBe('/absolute/path.sock')
  })

  // biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${workspaceFolder} string
  it('expands ${workspaceFolder} when workspaceRoot is provided', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${workspaceFolder} string
    const resolved = resolveSocketPath('${workspaceFolder}/foo.sock', '/workspace')
    expect(resolved).toBe('/workspace/foo.sock')
  })

  // biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${workspaceFolder} string
  it('expands ${workspaceFolder} at the start of a path', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${workspaceFolder} string
    const resolved = resolveSocketPath('${workspaceFolder}.sock', '/ws')
    expect(resolved).toBe('/ws.sock')
  })

  // biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${workspaceFolder} string
  it('leaves ${workspaceFolder} as-is when no workspaceRoot', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${workspaceFolder} string
    const resolved = resolveSocketPath('${workspaceFolder}/foo.sock')
    // Falls through to relative path resolution against homedir
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${workspaceFolder} string
    expect(resolved).toBe('/mock/home/${workspaceFolder}/foo.sock')
  })
})

describe('verifySocketSecurity', () => {
  it('passes if path does not exist (ENOENT)', () => {
    vi.mocked(fs.statSync).mockImplementationOnce(() => {
      const err = new Error('ENOENT') as any
      err.code = 'ENOENT'
      throw err
    })
    expect(() => verifySocketSecurity('/no-exist.sock')).not.toThrow()
  })

  it('throws error if file is not a socket', () => {
    vi.mocked(fs.statSync).mockReturnValueOnce({
      isSocket: () => false,
      uid: 1000,
      mode: 0o600,
    } as any)
    expect(() => verifySocketSecurity('/file.sock')).toThrow('Path exists but is not a socket')
  })

  it('throws error if socket is not owned by current user', () => {
    vi.mocked(fs.statSync).mockReturnValueOnce({
      isSocket: () => true,
      uid: 1001,
      mode: 0o600,
    } as any)
    expect(() => verifySocketSecurity('/bad-owner.sock')).toThrow('not owned by the current user')
  })

  it('throws error if socket is world-writable', () => {
    vi.mocked(fs.statSync).mockReturnValueOnce({
      isSocket: () => true,
      uid: 1000,
      mode: 0o666,
    } as any)
    expect(() => verifySocketSecurity('/world-writable.sock')).toThrow(
      'Socket file is world-writable',
    )
  })

  it('passes if socket is owned by current user and has secure permissions', () => {
    vi.mocked(fs.statSync).mockReturnValueOnce({
      isSocket: () => true,
      uid: 1000,
      mode: 0o600,
    } as any)
    expect(() => verifySocketSecurity('/secure.sock')).not.toThrow()
  })
})
